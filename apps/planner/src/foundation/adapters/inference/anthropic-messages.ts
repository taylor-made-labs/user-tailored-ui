/**
 * Real inference adapter: Anthropic Messages API over plain `fetch`, safe in a browser
 * (design 4.1, R2.2, R2.3, R2.6). No SDK dependency, so it adds nothing to the bundle.
 *
 * Routes (design 4.2):
 *  - managed / broker pass-through: `baseURL` = broker, no key header for managed.
 *  - direct BYOK: default baseURL, `direct: true` adds the browser-access header.
 *
 * The model reply is DATA. It is parsed strictly; anything off-shape is
 * `invalid-response`. Policy is still enforced downstream by the validator.
 * The key is read from a SecretString only when building the header, and is scrubbed
 * from every error message.
 */
import {
  InferenceError,
  type InferenceErrorKind,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResponse,
} from '../../ports/inference.js';
import type { CustomizationProposal } from '../../domain/customization/types.js';
import { scrub, type SecretString } from '../../security/secret-string.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicMessagesConfig {
  /** Model id. Config value (A15). */
  readonly model?: string;
  /** Broker URL for managed / pass-through; omit for direct. */
  readonly baseURL?: string;
  /** User's key (BYOK). Omit in managed mode: the broker adds its own. */
  readonly apiKey?: SecretString;
  /** Direct browser to provider. Key-exposing; the UI must label it. */
  readonly direct?: boolean;
  readonly fetch?: typeof fetch;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
}

const SYSTEM_PROMPT = [
  'You turn a natural-language UI customization request into a STRICT JSON',
  'customization proposal. Output ONLY one JSON object, no prose, no code fences.',
  'Allowed keys: "tokens" (object of token to string/number/boolean),',
  '"components" (array of {"componentId": string, "props"?: object}),',
  '"controls" (array of {"controlId": string}), "actions" (array of string),',
  '"rationale" (short string). Use only tokens, components and actions the',
  'request lists as allowed. Your output is untrusted and will be validated.',
].join(' ');

function buildPrompt(r: InferenceRequest): string {
  return [
    'ALLOWED SURFACE (JSON):',
    JSON.stringify(r.surface),
    '',
    'USER REQUEST (untrusted):',
    r.utterance,
  ].join('\n');
}

const bad = (msg: string): InferenceError => new InferenceError('invalid-response', msg);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPrim = (v: unknown): boolean => ['string', 'number', 'boolean'].includes(typeof v);
const isPrimMap = (v: unknown): boolean => isObj(v) && Object.values(v).every(isPrim);

const KEYS = new Set(['tokens', 'components', 'controls', 'actions', 'rationale']);

/** Strict proposal parse. Throws InferenceError('invalid-response') on any deviation. */
export function parseProposalStrict(text: string): CustomizationProposal {
  // Tolerate exactly one wrapping code fence; nothing else.
  const body = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1');
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    throw bad('Model reply was not valid JSON.');
  }
  if (!isObj(raw)) throw bad('Model reply JSON was not an object.');
  for (const k of Object.keys(raw)) {
    if (!KEYS.has(k)) throw bad(`Model reply has unknown field "${k}".`);
  }
  const { tokens, components, controls, actions, rationale } = raw;
  if (tokens !== undefined && !isPrimMap(tokens)) throw bad('"tokens" has the wrong shape.');
  if (
    components !== undefined &&
    !(
      Array.isArray(components) &&
      components.every(
        (c) =>
          isObj(c) &&
          typeof c['componentId'] === 'string' &&
          (c['props'] === undefined || isPrimMap(c['props'])),
      )
    )
  )
    throw bad('"components" has the wrong shape.');
  if (
    controls !== undefined &&
    !(Array.isArray(controls) && controls.every((c) => isObj(c) && typeof c['controlId'] === 'string'))
  )
    throw bad('"controls" has the wrong shape.');
  if (
    actions !== undefined &&
    !(Array.isArray(actions) && actions.every((a) => typeof a === 'string'))
  )
    throw bad('"actions" has the wrong shape.');
  if (rationale !== undefined && typeof rationale !== 'string')
    throw bad('"rationale" has the wrong shape.');
  return raw as CustomizationProposal;
}

function mapStatus(status: number, errType: string, errMsg: string): InferenceErrorKind {
  const text = `${errType} ${errMsg}`.toLowerCase();
  if (status === 401 || status === 403) return 'auth';
  if (status === 402 || /credit|billing|quota/.test(text)) return 'quota';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'network';
  if (status === 400 || status === 404) return 'invalid-response';
  return 'unknown';
}

export class AnthropicMessagesAdapter implements InferenceProvider {
  readonly id = 'anthropic';
  /** REAL adapter. Never a simulation. */
  readonly simulated = false;
  readonly #c: AnthropicMessagesConfig;

  constructor(config: AnthropicMessagesConfig = {}) {
    this.#c = config;
  }

  async propose(request: InferenceRequest): Promise<InferenceResponse> {
    const c = this.#c;
    const doFetch = c.fetch ?? globalThis.fetch.bind(globalThis);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };
    if (c.apiKey) headers['x-api-key'] = c.apiKey.reveal();
    if (c.direct) headers['anthropic-dangerous-direct-browser-access'] = 'true';

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), c.timeoutMs ?? 60_000);
    let res: Response;
    try {
      res = await doFetch(`${(c.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers,
        signal: ctl.signal,
        body: JSON.stringify({
          model: c.model ?? DEFAULT_ANTHROPIC_MODEL,
          max_tokens: c.maxTokens ?? 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildPrompt(request) }],
        }),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : 'request failed';
      throw new InferenceError('network', scrub(`Network error: ${m}`, c.apiKey));
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }

    if (!res.ok) {
      const e = isObj(payload) && isObj(payload['error']) ? payload['error'] : {};
      const type = typeof e['type'] === 'string' ? e['type'] : '';
      const msg = typeof e['message'] === 'string' ? e['message'] : '';
      throw new InferenceError(
        mapStatus(res.status, type, msg),
        scrub(`Provider returned ${res.status}${type ? ` (${type})` : ''}${msg ? `: ${msg}` : ''}`, c.apiKey),
      );
    }

    const content = isObj(payload) ? payload['content'] : undefined;
    const first: unknown = Array.isArray(content) ? content[0] : undefined;
    if (!isObj(first) || first['type'] !== 'text' || typeof first['text'] !== 'string') {
      throw bad('Provider reply had no text content.');
    }
    return { proposal: parseProposalStrict(first['text']), providerId: this.id, simulated: false };
  }
}

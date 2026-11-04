/**
 * Real inference adapter backed by the **Claude Agent SDK**
 * (`@anthropic-ai/claude-agent-sdk`), authenticated by the user's **Claude
 * subscription** via Claude Code's OAuth login on the machine.
 *
 * Honesty / auth contract (steering 20-engineering):
 *   - This adapter rides an EXISTING `claude` CLI OAuth login. It does NOT take,
 *     read, embed, or log an `sk-ant-` API key. The one-time setup is a human
 *     running `claude` (the Claude Code CLI) and signing in with their
 *     subscription; the Agent SDK then uses that login automatically. See the
 *     README section "Claude subscription adapter".
 *   - `simulated` is `false`: results are labeled as REAL so the UI never
 *     presents them as a test double (and never the reverse).
 *
 * Safety contract:
 *   - The agent's output is DATA — a `CustomizationProposal` — and is NEVER
 *     executed as code. It is always validated downstream against the creator
 *     policy before anything is applied; the provider is never trusted.
 *   - The query is constrained to a single, TOOL-LESS, single-shot text turn:
 *     no tools, no subagents, no filesystem settings, `maxTurns: 1`. The Agent
 *     SDK can otherwise run an autonomous agent loop against the host machine;
 *     we disable that entirely and want only a plain text completion.
 *
 * Decoupling contract:
 *   - `src/` has NO static dependency on the SDK. The SDK's `query` function is
 *     INJECTED (dependency injection) via a minimal structural boundary type
 *     (`AgentSdkQuery`). This keeps the deterministic, keyless CI build free of
 *     the SDK's native binary, and lets unit tests exercise the mapping logic
 *     with the boundary mocked — no network, no login. The real `query` is
 *     wired only at the composition root / live smoke test.
 */

import {
  InferenceError,
  type InferenceErrorKind,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResponse,
} from '../../ports/inference.js';
import type { CustomizationProposal } from '../../domain/customization/types.js';

/* ------------------------------------------------------------------------- *
 * Minimal structural boundary to the Claude Agent SDK.
 *
 * We model only what this adapter reads, so `src/` never imports the SDK. The
 * shapes mirror the Agent SDK's public `query()` contract:
 *   - `query({ prompt, options })` returns an async iterable of messages.
 *   - a terminal message with `type: 'result'` carries the final text and an
 *     `is_error` flag plus a `subtype`.
 *   - assistant messages may carry an error code in `message.error`
 *     (SDKAssistantMessageError), e.g. 'authentication_failed', 'rate_limit'.
 * The real `@anthropic-ai/claude-agent-sdk` `query` is structurally assignable
 * to `AgentSdkQuery`; see the live smoke test for the wiring.
 * ------------------------------------------------------------------------- */

/** The subset of Agent SDK `Options` this adapter sets. */
export interface AgentSdkQueryOptions {
  /** Which Claude model to use (alias or full id). Optional; CLI default otherwise. */
  readonly model?: string;
  /** Hard cap on agentic turns. We always pass 1 (single-shot). */
  readonly maxTurns?: number;
  /** Tools to auto-approve. We pass [] — approve nothing. */
  readonly allowedTools?: readonly string[];
  /** Tools to deny. We pass ['*'] — deny every tool. */
  readonly disallowedTools?: readonly string[];
  /** Filesystem settings sources. We pass [] — load none (no CLAUDE.md, no project config). */
  readonly settingSources?: readonly string[];
  /** System prompt. We pass a plain string so no Claude Code preset / tools are implied. */
  readonly systemPrompt?: string;
  /** Abort controller for cancellation / timeout. */
  readonly abortController?: AbortController;
}

/**
 * One element of the SDK message stream. Modeled as a single open shape rather
 * than a closed discriminated union: the real SDK stream carries many message
 * types (system, user, stream_event, ...) and more may be added across SDK
 * versions, so we read by `type` and treat every unknown type as a no-op. The
 * fields we read are optional and narrowed by `type` at the call site.
 */
export interface AgentSdkMessage {
  /** Discriminator: 'result', 'assistant', or any other SDK message type. */
  readonly type: string;
  /** On `type: 'result'`: the terminal result subtype (e.g. 'success', 'rate_limit'). */
  readonly subtype?: string;
  /** On `type: 'result'`: true when the turn ended in error. */
  readonly is_error?: boolean;
  /** On `type: 'result'`: the final assistant text on the success arm. */
  readonly result?: string;
  /**
   * On `type: 'assistant'`: the assistant message. `error` carries the typed SDK
   * error code (SDKAssistantMessageError) when the turn errored.
   */
  readonly message?: {
    readonly error?: string;
    readonly content?: unknown;
  };
}

/** A terminal result message from the SDK message stream. */
export type AgentSdkResultMessage = AgentSdkMessage & { readonly type: 'result' };

/** An assistant message; `message.error` carries the typed SDK error code when present. */
export type AgentSdkAssistantMessage = AgentSdkMessage & { readonly type: 'assistant' };

/** The injected `query` function. Mirrors the SDK's `query({ prompt, options })`. */
export type AgentSdkQuery = (args: {
  readonly prompt: string;
  readonly options?: AgentSdkQueryOptions;
}) => AsyncIterable<AgentSdkMessage>;

/* ------------------------------------------------------------------------- *
 * Adapter configuration.
 * ------------------------------------------------------------------------- */

export interface AgentSdkAdapterConfig {
  /**
   * The Agent SDK `query` function. REQUIRED and injected — the adapter never
   * imports the SDK itself. Wire the real one at the composition root:
   *   `import { query } from '@anthropic-ai/claude-agent-sdk';`
   */
  readonly query: AgentSdkQuery;
  /** Optional model override (alias like 'sonnet' or a full model id). */
  readonly model?: string;
  /** Milliseconds before the single query turn is aborted. Default 60_000. */
  readonly timeoutMs?: number;
  /** Provider id reported on responses. Default 'claude-agent-sdk'. */
  readonly providerId?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PROVIDER_ID = 'claude-agent-sdk';

/**
 * Maps the Agent SDK's assistant-error codes (SDKAssistantMessageError) and
 * terminal result subtypes onto the port's typed `InferenceErrorKind`.
 */
function mapSdkErrorCode(code: string): InferenceErrorKind {
  switch (code) {
    case 'authentication_failed':
    case 'oauth_org_not_allowed':
    case 'account_on_hold':
    case 'cloud_credential_error':
      return 'auth';
    case 'billing_error':
      return 'quota';
    case 'rate_limit':
      return 'rate-limit';
    case 'overloaded':
    case 'server_error':
      return 'network';
    case 'invalid_request':
    case 'model_not_found':
    case 'max_output_tokens':
      return 'invalid-response';
    default:
      return 'unknown';
  }
}

/**
 * Builds the single-shot, tool-less query options. Centralised so the safety
 * posture (no tools, no settings, one turn) is in exactly one place.
 */
function buildOptions(
  config: AgentSdkAdapterConfig,
  abortController: AbortController,
): AgentSdkQueryOptions {
  const base = {
    maxTurns: 1,
    allowedTools: [] as readonly string[],
    disallowedTools: ['*'] as readonly string[],
    settingSources: [] as readonly string[],
    systemPrompt: SYSTEM_PROMPT,
    abortController,
  };
  // exactOptionalPropertyTypes: only attach `model` when actually set.
  return config.model === undefined ? base : { ...base, model: config.model };
}

const SYSTEM_PROMPT = [
  'You turn a natural-language UI customization request into a STRICT JSON',
  'customization proposal. Output ONLY a single JSON object, no prose, no code',
  'fences. The object may contain any of: "tokens" (object of token->value),',
  '"components" (array of { "componentId": string, "props"?: object }),',
  '"controls" (array of { "controlId": string }), "actions" (array of string),',
  'and "rationale" (short string for display). Only reference tokens,',
  'components, and actions that the request says are allowed. Your output is',
  'untrusted data that will be validated against a policy; never include code,',
  'instructions, or anything other than the JSON object.',
].join(' ');

/**
 * Renders the request into a single prompt. The surface description is passed
 * as plain, non-sensitive context (allowed tokens/components/actions + a
 * summary) so the model proposes within bounds — validation still enforces it.
 */
function buildPrompt(request: InferenceRequest): string {
  const { utterance, surface } = request;
  const context = {
    overridableTokens: surface.overridableTokens,
    allowedComponents: surface.allowedComponents,
    allowedActions: surface.allowedActions,
    currentViewSummary: surface.currentViewSummary,
  };
  return [
    'ALLOWED SURFACE (JSON):',
    JSON.stringify(context),
    '',
    'USER REQUEST (untrusted natural language):',
    utterance,
    '',
    'Respond with ONLY the JSON customization proposal object.',
  ].join('\n');
}

/**
 * Extracts the first balanced top-level JSON object from the model text. The
 * model is asked for bare JSON, but we tolerate accidental surrounding prose /
 * fences by scanning for the first `{ ... }` with balanced braces (ignoring
 * braces inside strings). Returns `null` when no object is found.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parses the model text into a `CustomizationProposal`. This is a shallow,
 * defensive projection: it keeps only the known proposal fields and only when
 * they have the right primitive shape. It deliberately does NOT enforce policy
 * (that is the validator's job) — it only guarantees the value is a well-formed
 * proposal object so the downstream validator receives data, not garbage.
 */
function parseProposal(text: string): CustomizationProposal {
  const json = extractJsonObject(text);
  if (json === null) {
    throw new InferenceError(
      'invalid-response',
      'Agent SDK returned no JSON object in its response.',
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new InferenceError(
      'invalid-response',
      `Agent SDK response was not valid JSON: ${(err as Error).message}`,
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InferenceError(
      'invalid-response',
      'Agent SDK response JSON was not an object.',
    );
  }
  const obj = raw as Record<string, unknown>;
  const proposal: {
    -readonly [K in keyof CustomizationProposal]: CustomizationProposal[K];
  } = {};

  if (isTokenSet(obj['tokens'])) proposal.tokens = obj['tokens'];
  if (isComponentArray(obj['components'])) proposal.components = obj['components'];
  if (isControlArray(obj['controls'])) proposal.controls = obj['controls'];
  if (isStringArray(obj['actions'])) proposal.actions = obj['actions'];
  if (typeof obj['rationale'] === 'string') proposal.rationale = obj['rationale'];

  return proposal;
}

function isPrimitive(v: unknown): v is string | number | boolean {
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'boolean';
}

function isTokenSet(v: unknown): v is Readonly<Record<string, string | number | boolean>> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(isPrimitive);
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isComponentArray(
  v: unknown,
): v is readonly { componentId: string; props?: Record<string, string | number | boolean> }[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => {
    if (typeof x !== 'object' || x === null) return false;
    const o = x as Record<string, unknown>;
    if (typeof o['componentId'] !== 'string') return false;
    if (o['props'] !== undefined && !isTokenSet(o['props'])) return false;
    return true;
  });
}

function isControlArray(v: unknown): v is readonly { controlId: string }[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as Record<string, unknown>)['controlId'] === 'string',
  );
}

/** Classifies a thrown transport/runtime error into a typed InferenceError. */
function classifyThrown(err: unknown): InferenceError {
  if (err instanceof InferenceError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let kind: InferenceErrorKind = 'unknown';
  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('timed out')) {
    kind = 'network';
  } else if (lower.includes('econn') || lower.includes('network') || lower.includes('fetch')) {
    kind = 'network';
  } else if (
    lower.includes('login') ||
    lower.includes('unauthor') ||
    lower.includes('authenticat') ||
    lower.includes('oauth') ||
    lower.includes('not logged in')
  ) {
    kind = 'auth';
  } else if (lower.includes('rate limit') || lower.includes('429')) {
    kind = 'rate-limit';
  } else if (lower.includes('quota') || lower.includes('billing')) {
    kind = 'quota';
  }
  return new InferenceError(kind, `Agent SDK query failed: ${message}`);
}

export class AgentSdkInferenceAdapter implements InferenceProvider {
  readonly id: string;
  /** REAL adapter — never a simulation. The UI labels these results as real. */
  readonly simulated = false;

  private readonly config: AgentSdkAdapterConfig;

  constructor(config: AgentSdkAdapterConfig) {
    this.config = config;
    this.id = config.providerId ?? DEFAULT_PROVIDER_ID;
  }

  async propose(request: InferenceRequest): Promise<InferenceResponse> {
    const abortController = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const prompt = buildPrompt(request);
      const options = buildOptions(this.config, abortController);

      let resultText: string | null = null;
      let sdkErrorCode: string | null = null;

      for await (const message of this.config.query({ prompt, options })) {
        if (message.type === 'assistant') {
          const code = message.message?.error;
          if (typeof code === 'string' && code.length > 0) {
            sdkErrorCode = code;
          }
        } else if (message.type === 'result') {
          if (message.is_error === true) {
            // Prefer an assistant error code seen earlier; else use the subtype.
            const code = sdkErrorCode ?? message.subtype ?? 'unknown';
            throw new InferenceError(
              mapSdkErrorCode(code),
              `Agent SDK ended with an error (${code}).`,
            );
          }
          resultText = typeof message.result === 'string' ? message.result : '';
          break;
        }
      }

      // The stream ended but an assistant error was seen without a result.
      if (resultText === null && sdkErrorCode !== null) {
        throw new InferenceError(
          mapSdkErrorCode(sdkErrorCode),
          `Agent SDK reported an error (${sdkErrorCode}).`,
        );
      }
      if (resultText === null) {
        throw new InferenceError(
          'invalid-response',
          'Agent SDK stream ended without a result message.',
        );
      }

      const proposal = parseProposal(resultText);
      return {
        proposal,
        providerId: this.id,
        simulated: false,
      };
    } catch (err) {
      throw classifyThrown(err);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Key broker (T3.3, design 4.3). Host-neutral: a plain function from a request
 * description to a response description. Wrappers: `lambda.ts`, `server.ts`.
 *
 * Keys: BYOK forwards the caller's `x-api-key`; managed adds `ANTHROPIC_API_KEY` from env.
 * A key never goes to a log, an error, or a response body. We never log headers or bodies.
 *
 * NOTE: `SecretString` (PR #18) is not merged yet, so keys are plain strings that stay
 * local to `handle` and are never put in any returned or logged value.
 */

export interface BrokerConfig {
  allowedOrigins: readonly string[];
  allowedModels: readonly string[];
  maxTokensCap: number;
  maxBodyBytes: number;
  /** Requests per IP per window. shortcut: in-memory per instance, move to a shared store when scaling. */
  rateLimit: { max: number; windowMs: number };
  upstreamUrl?: string;
}

export interface BrokerRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>; // lower-case names
  body: string;
  ip: string;
}

export interface BrokerResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface BrokerDeps {
  config: BrokerConfig;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  now?: () => number;
  /** Receives non-secret event strings only. */
  log?: (line: string) => void;
}

export type BrokerErrorKind =
  | 'auth' | 'quota' | 'rate-limit' | 'network' | 'bad-request' | 'forbidden' | 'not-found' | 'too-large';

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

export function createBroker(deps: BrokerDeps): (req: BrokerRequest) => Promise<BrokerResponse> {
  const { config, env } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => undefined);
  const hits = new Map<string, number[]>();

  const respond = (status: number, origin: string | undefined, body: string, extra: Record<string, string> = {}): BrokerResponse => {
    const headers: Record<string, string> = { 'content-type': 'application/json', vary: 'origin', ...extra };
    if (origin !== undefined && config.allowedOrigins.includes(origin)) {
      headers['access-control-allow-origin'] = origin;
    }
    return { status, headers, body };
  };
  const fail = (status: number, kind: BrokerErrorKind, message: string, origin?: string): BrokerResponse => {
    log(`refused status=${status} kind=${kind}`);
    return respond(status, origin, JSON.stringify({ error: { kind, message } }));
  };

  return async (req) => {
    const origin = req.headers['origin'];
    if (origin === undefined || !config.allowedOrigins.includes(origin)) {
      return fail(403, 'forbidden', 'Origin not allowed.');
    }
    if (req.method === 'OPTIONS') {
      return respond(204, origin, '', {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-api-key',
        'access-control-max-age': '600',
      });
    }
    if (req.method !== 'POST' || req.path !== '/v1/messages') {
      return fail(404, 'not-found', 'Only POST /v1/messages is available.', origin);
    }

    // Per-IP rate limit.
    const t = now();
    const recent = (hits.get(req.ip) ?? []).filter((x) => t - x < config.rateLimit.windowMs);
    if (recent.length >= config.rateLimit.max) {
      hits.set(req.ip, recent);
      return fail(429, 'rate-limit', 'Too many requests.', origin);
    }
    recent.push(t);
    hits.set(req.ip, recent);

    if (Buffer.byteLength(req.body, 'utf8') > config.maxBodyBytes) {
      return fail(413, 'too-large', 'Request body too large.', origin);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body);
    } catch {
      return fail(400, 'bad-request', 'Body must be JSON.', origin);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return fail(400, 'bad-request', 'Body must be a JSON object.', origin);
    }
    const body = parsed as Record<string, unknown>;
    if (typeof body['model'] !== 'string' || !config.allowedModels.includes(body['model'])) {
      return fail(400, 'bad-request', 'Model not allowed.', origin);
    }
    const mt = body['max_tokens'];
    if (typeof mt !== 'number' || !Number.isInteger(mt) || mt < 1 || mt > config.maxTokensCap) {
      return fail(400, 'bad-request', `max_tokens must be an integer from 1 to ${config.maxTokensCap}.`, origin);
    }
    if (body['stream'] === true) {
      return fail(400, 'bad-request', 'Streaming is not supported.', origin);
    }

    // BYOK if the caller sent a key, else managed. The key is used only in this call.
    const callerKey = req.headers['x-api-key'];
    const key = callerKey !== undefined && callerKey !== '' ? callerKey : env['ANTHROPIC_API_KEY'];
    const mode = callerKey !== undefined && callerKey !== '' ? 'byok' : 'managed';
    if (key === undefined || key === '') {
      return fail(401, 'auth', 'No API key available.', origin);
    }

    let upstream: Response;
    try {
      upstream = await deps.fetch(config.upstreamUrl ?? UPSTREAM, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': req.headers['anthropic-version'] ?? '2023-06-01',
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Never include the thrown error: it could carry request details.
      return fail(502, 'network', 'Could not reach the provider.', origin);
    }

    const text = await upstream.text();
    log(`relayed mode=${mode} status=${upstream.status}`);
    if (upstream.ok) {
      // Defence in depth: never echo the key, even if upstream did.
      return respond(upstream.status, origin, text.split(key).join('[redacted]'));
    }
    // Error text from upstream is dropped; only a typed kind goes back.
    if (upstream.status === 401 || upstream.status === 403) return fail(401, 'auth', 'The provider rejected the key.', origin);
    if (upstream.status === 402 || (upstream.status === 429 && /quota|credit|billing/i.test(text))) {
      return fail(429, 'quota', 'Provider quota or credit exhausted.', origin);
    }
    if (upstream.status === 429) return fail(429, 'rate-limit', 'Provider rate limit.', origin);
    return fail(upstream.status >= 500 ? 502 : 400, upstream.status >= 500 ? 'network' : 'bad-request', 'Provider error.', origin);
  };
}

export const defaultConfig = (origins: readonly string[]): BrokerConfig => ({
  allowedOrigins: origins,
  allowedModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  maxTokensCap: 4096,
  maxBodyBytes: 64 * 1024,
  rateLimit: { max: 30, windowMs: 60_000 },
});

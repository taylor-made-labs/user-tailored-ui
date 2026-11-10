import { describe, expect, it, vi } from 'vitest';
import { createBroker, defaultConfig } from '../src/broker/handler.js';
import type { BrokerRequest } from '../src/broker/handler.js';
import { createLambdaHandler } from '../src/broker/lambda.js';

const ORIGIN = 'https://app.example';
const CANARY = 'sk-ant-CANARY-user-key-123456';
const SERVER_KEY = 'sk-ant-CANARY-server-key-654321';
const MODEL = 'claude-sonnet-4-5';

function setup(upstream: (url: string, init: RequestInit) => Response, over = {}) {
  const logs: string[] = [];
  const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(upstream(String(url), init ?? {})));
  const broker = createBroker({
    config: { ...defaultConfig([ORIGIN]), ...over },
    env: { ANTHROPIC_API_KEY: SERVER_KEY },
    fetch: fetchMock as unknown as typeof fetch,
    log: (l) => logs.push(l),
  });
  return { broker, fetchMock, logs };
}
const req = (o: Partial<BrokerRequest> = {}): BrokerRequest => ({
  method: 'POST', path: '/v1/messages', ip: '1.1.1.1',
  headers: { origin: ORIGIN },
  body: JSON.stringify({ model: MODEL, max_tokens: 100, messages: [] }),
  ...o,
});
const ok = () => new Response('{"content":[]}', { status: 200 });
const sentKey = (m: { mock: { calls: unknown[][] } }) => ((m.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>)['x-api-key'];

describe('broker', () => {
  it('managed mode adds the server key', async () => {
    const { broker, fetchMock } = setup(ok);
    const r = await broker(req());
    expect(r.status).toBe(200);
    expect(sentKey(fetchMock)).toBe(SERVER_KEY);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('BYOK passes the caller key through and never logs it', async () => {
    const { broker, fetchMock, logs } = setup(ok);
    const r = await broker(req({ headers: { origin: ORIGIN, 'x-api-key': CANARY } }));
    expect(sentKey(fetchMock)).toBe(CANARY);
    expect(JSON.stringify([logs, r])).not.toContain(CANARY);
    expect(JSON.stringify([logs, r])).not.toContain(SERVER_KEY);
  });

  it('refuses bad origin, route, model, max_tokens, oversize, bad JSON, streaming', async () => {
    const { broker, fetchMock } = setup(ok, { maxBodyBytes: 200 });
    expect((await broker(req({ headers: { origin: 'https://evil.example' } }))).status).toBe(403);
    expect((await broker(req({ headers: {} }))).status).toBe(403);
    expect((await broker(req({ path: '/v1/complete' }))).status).toBe(404);
    expect((await broker(req({ method: 'GET' }))).status).toBe(404);
    expect((await broker(req({ body: JSON.stringify({ model: 'gpt-x', max_tokens: 5 }) }))).status).toBe(400);
    expect((await broker(req({ body: JSON.stringify({ model: MODEL, max_tokens: 999999 }) }))).status).toBe(400);
    expect((await broker(req({ body: JSON.stringify({ model: MODEL, max_tokens: 5, pad: 'x'.repeat(300) }) }))).status).toBe(413);
    expect((await broker(req({ body: 'nope' }))).status).toBe(400);
    expect((await broker(req({ body: JSON.stringify({ model: MODEL, max_tokens: 5, stream: true }) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers the CORS preflight only for allowed origins', async () => {
    const { broker } = setup(ok);
    expect((await broker(req({ method: 'OPTIONS' }))).status).toBe(204);
    expect((await broker(req({ method: 'OPTIONS', headers: { origin: 'https://x.example' } }))).status).toBe(403);
  });

  it('rate limits per IP', async () => {
    const { broker } = setup(ok, { rateLimit: { max: 2, windowMs: 60_000 } });
    expect((await broker(req())).status).toBe(200);
    expect((await broker(req())).status).toBe(200);
    expect((await broker(req())).status).toBe(429);
    expect((await broker(req({ ip: '2.2.2.2' }))).status).toBe(200);
  });

  it('maps upstream errors to kinds and drops upstream text (even if it echoes the key)', async () => {
    const cases: Array<[number, string, string]> = [
      [401, 'x', 'auth'], [429, 'rate limited', 'rate-limit'], [429, 'credit balance too low', 'quota'],
      [402, 'x', 'quota'], [500, 'x', 'network'], [400, 'x', 'bad-request'],
    ];
    for (const [status, text, kind] of cases) {
      const { broker, logs } = setup(() => new Response(`bad key ${CANARY} ${text}`, { status }));
      const r = await broker(req({ headers: { origin: ORIGIN, 'x-api-key': CANARY } }));
      expect(JSON.parse(r.body).error.kind).toBe(kind);
      expect(JSON.stringify([logs, r])).not.toContain(CANARY);
    }
  });

  it('redacts the key from a successful reply and hides network error details', async () => {
    const a = setup(() => new Response(`{"echo":"${CANARY}"}`, { status: 200 }));
    const r = await a.broker(req({ headers: { origin: ORIGIN, 'x-api-key': CANARY } }));
    expect(r.body).not.toContain(CANARY);
    const b = setup(() => { throw new Error(`boom ${CANARY}`); });
    const e = await b.broker(req({ headers: { origin: ORIGIN, 'x-api-key': CANARY } }));
    expect(e.status).toBe(502);
    expect(JSON.stringify([b.logs, e])).not.toContain(CANARY);
  });

  it('401 when neither a caller key nor a server key exists', async () => {
    const broker = createBroker({ config: defaultConfig([ORIGIN]), env: {}, fetch: vi.fn() as unknown as typeof fetch });
    expect(JSON.parse((await broker(req())).body).error.kind).toBe('auth');
  });

  it('lambda wrapper maps events', async () => {
    const h = createLambdaHandler({ BROKER_ALLOWED_ORIGINS: ORIGIN });
    const r = await h({ rawPath: '/nope', headers: { Origin: ORIGIN }, requestContext: { http: { method: 'POST' } } });
    expect(r.statusCode).toBe(404);
  });
});

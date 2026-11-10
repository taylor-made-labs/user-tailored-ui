import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { IDBFactory } from 'fake-indexeddb';
import {
  AnthropicMessagesAdapter,
  parseProposalStrict,
} from '../src/adapters/inference/anthropic-messages.js';
import { IdbKeyStore, SessionKeyStore } from '../src/adapters/keys/key-store.js';
import { SecretString } from '../src/security/secret-string.js';
import { InferenceError, type InferenceRequest } from '../src/ports/inference.js';
import { CustomizationOrchestrator } from '../src/domain/customization/orchestrator.js';
import { InMemoryHistoryStore } from '../src/adapters/history/in-memory.js';
import type { ViewDescriptor } from '../src/domain/customization/types.js';

// Not a key. Canary string used to prove it never leaks.
const CANARY = 'CANARY-KEY-0000000000000000';
const key = new SecretString(CANARY);

const request: InferenceRequest = {
  utterance: 'compact agenda',
  surface: {
    overridableTokens: ['density'],
    allowedComponents: ['board', 'agenda'],
    allowedActions: ['task.complete'],
    currentViewSummary: 'board',
  },
};

const ok = (text: string) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });
const fail = (status: number, type: string, message: string) =>
  new Response(JSON.stringify({ type: 'error', error: { type, message } }), { status });

function adapter(f: typeof fetch, extra = {}) {
  return new AnthropicMessagesAdapter({ apiKey: key, fetch: f, ...extra });
}

async function kindOf(p: Promise<unknown>): Promise<InferenceError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(InferenceError);
    return e as InferenceError;
  }
  throw new Error('expected rejection');
}

describe('AnthropicMessagesAdapter', () => {
  it('parses a valid proposal and labels it real', async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | undefined;
    const f = ((url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string>, body: String(init.body) };
      return Promise.resolve(ok('{"tokens":{"density":"compact"},"rationale":"ok"}'));
    }) as unknown as typeof fetch;
    const res = await adapter(f, { direct: true }).propose(request);
    expect(res.simulated).toBe(false);
    expect(res.providerId).toBe('anthropic');
    expect(res.proposal.tokens).toEqual({ density: 'compact' });
    expect(seen?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(seen?.headers['x-api-key']).toBe(CANARY);
    expect(seen?.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('managed mode via broker sends no key and no browser-access header', async () => {
    let headers: Record<string, string> = {};
    let url = '';
    const f = ((u: string, init: RequestInit) => {
      url = u;
      headers = init.headers as Record<string, string>;
      return Promise.resolve(ok('{}'));
    }) as unknown as typeof fetch;
    await new AnthropicMessagesAdapter({ baseURL: 'https://broker.example/', fetch: f }).propose(request);
    expect(url).toBe('https://broker.example/v1/messages');
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['anthropic-dangerous-direct-browser-access']).toBeUndefined();
  });

  it('bad JSON -> invalid-response', async () => {
    const e = await kindOf(adapter((() => Promise.resolve(ok('not json'))) as unknown as typeof fetch).propose(request));
    expect(e.kind).toBe('invalid-response');
  });

  it.each([
    '[]',
    '{"tokens":{"a":{"x":1}}}',
    '{"components":[{"id":"x"}]}',
    '{"actions":"task.complete"}',
    '{"extra":1}',
  ])('wrong shape %s -> invalid-response', async (text) => {
    const e = await kindOf(adapter((() => Promise.resolve(ok(text))) as unknown as typeof fetch).propose(request));
    expect(e.kind).toBe('invalid-response');
  });

  it('accepts one wrapping json fence, nothing else', () => {
    expect(parseProposalStrict('```json\n{"actions":["a"]}\n```')).toEqual({ actions: ['a'] });
    expect(() => parseProposalStrict('Here: {"actions":[]}')).toThrow(InferenceError);
  });

  it('401 -> auth, 429 -> rate-limit, credit text -> quota, 500 -> network', async () => {
    const run = (r: () => Response) =>
      kindOf(adapter((() => Promise.resolve(r())) as unknown as typeof fetch).propose(request));
    expect((await run(() => fail(401, 'authentication_error', 'invalid x-api-key'))).kind).toBe('auth');
    expect((await run(() => fail(429, 'rate_limit_error', 'slow down'))).kind).toBe('rate-limit');
    expect((await run(() => fail(400, 'invalid_request_error', 'credit balance is too low'))).kind).toBe('quota');
    expect((await run(() => fail(529, 'overloaded_error', 'busy'))).kind).toBe('network');
  });

  it('network failure -> network', async () => {
    const f = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    expect((await kindOf(adapter(f).propose(request))).kind).toBe('network');
  });
});

describe('key canary (R3.4): the key never appears in logs, JSON, errors, history', () => {
  it('SecretString prints redacted everywhere', () => {
    expect(String(key)).toBe('[redacted]');
    expect(`${key}`).toBe('[redacted]');
    expect(JSON.stringify({ key })).not.toContain(CANARY);
    expect(JSON.stringify(Object.assign({}, { key }, { ...key }))).not.toContain(CANARY);
    expect(inspect(key)).not.toContain(CANARY);
    expect(inspect({ a: new AnthropicMessagesAdapter({ apiKey: key }) }, { depth: 5, showHidden: true })).not.toContain(CANARY);
  });

  it('error text scrubs a key echoed by the provider', async () => {
    const f = (() => Promise.resolve(fail(401, 'authentication_error', `bad key ${CANARY}`))) as unknown as typeof fetch;
    const e = await kindOf(adapter(f).propose(request));
    expect(e.message).not.toContain(CANARY);
    const g = (() => Promise.reject(new Error(`boom ${CANARY}`))) as unknown as typeof fetch;
    expect((await kindOf(adapter(g).propose(request))).message).not.toContain(CANARY);
  });

  it('a full propose->save flow leaves the key out of saved history', async () => {
    const history = new InMemoryHistoryStore();
    const base: ViewDescriptor = {
      tokens: { density: 'comfortable' },
      components: [{ componentId: 'board' }],
      controls: [],
      actions: [],
    };
    const orch = new CustomizationOrchestrator({
      policy: {
        version: 'p1',
        allowedActions: [],
        requiredControls: [],
        allowedComponents: ['board', 'agenda'],
        tokenRules: { density: { kind: 'enum', values: ['compact', 'comfortable'] } },
      },
      inference: adapter((() => Promise.resolve(ok('{"tokens":{"density":"compact"}}'))) as unknown as typeof fetch),
      history,
      appVersion: 'a1',
    });
    const out = await orch.proposeFromUtterance(base, 'compact');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const scope = { userId: 'u', appId: 'a' };
    await orch.applyAndSave(scope, base, out.preview.view, 'm');
    const dump = JSON.stringify([await history.list(scope), out]);
    expect(dump).not.toContain(CANARY);
  });
});

describe('KeyStore', () => {
  it('session store holds and clears', async () => {
    const s = new SessionKeyStore();
    await s.set(key);
    expect((await s.get())?.reveal()).toBe(CANARY);
    await s.clear();
    expect(await s.get()).toBeUndefined();
  });

  it('IDB store persists only on explicit set and clears', async () => {
    const idb = new IDBFactory();
    const s = new IdbKeyStore(idb);
    expect(await s.get()).toBeUndefined();
    await s.set(key);
    expect((await new IdbKeyStore(idb).get())?.reveal()).toBe(CANARY);
    await s.clear();
    expect(await s.get()).toBeUndefined();
  });
});

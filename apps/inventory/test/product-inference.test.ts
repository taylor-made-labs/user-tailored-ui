import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  InferenceError,
  SecretString,
  SessionKeyStore,
  type InferenceRequest,
} from '../src/ports/foundation.js';
import { createProductInference } from '../src/inference.js';

const req: InferenceRequest = {
  utterance: 'x',
  surface: { overridableTokens: [], allowedComponents: [], allowedActions: [], currentViewSummary: '' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('product inference (real model only)', () => {
  it('is never simulated', () => {
    expect(createProductInference(new SessionKeyStore()).simulated).toBe(false);
  });

  it('with no key it refuses with a typed auth error and makes no request', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const p = createProductInference(new SessionKeyStore()).propose(req);
    await expect(p).rejects.toBeInstanceOf(InferenceError);
    await expect(p).rejects.toMatchObject({ kind: 'auth' });
    expect(f).not.toHaveBeenCalled();
  });

  it('with a key it calls the provider, and the error text never holds the key', async () => {
    const keys = new SessionKeyStore();
    await keys.set(new SecretString('CANARY-KEY-TEST'));
    const f = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'bad CANARY-KEY-TEST' } }), { status: 401 }),
      ),
    );
    vi.stubGlobal('fetch', f);
    const err = await createProductInference(keys).propose(req).catch((e: unknown) => e);
    expect(f).toHaveBeenCalledOnce();
    expect(err).toMatchObject({ kind: 'auth' });
    expect(String((err as Error).message)).not.toContain('CANARY-KEY-TEST');
  });
});

/**
 * Unit tests for the Claude Agent SDK inference adapter.
 *
 * The SDK boundary is MOCKED/INJECTED — no network, no `claude` login, no real
 * SDK. These tests verify ONLY the adapter's mapping logic:
 *   - prompt in  -> proposal out (JSON parsing + defensive projection)
 *   - each SDK failure -> the right typed InferenceError kind
 *   - the safety posture passed to the SDK (single-shot, tool-less, no settings)
 *   - honest labeling (simulated === false)
 * They run deterministically and green in CI, which keeps no subscription login.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentSdkInferenceAdapter,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  type AgentSdkMessage,
  type AgentSdkQuery,
  type AgentSdkQueryOptions,
} from '../src/adapters/inference/agent-sdk.js';
import { InferenceError, type InferenceRequest } from '../src/ports/inference.js';

const request: InferenceRequest = {
  utterance: 'turn my board into a focused daily agenda',
  surface: {
    overridableTokens: ['density', 'fontScale'],
    allowedComponents: ['board', 'agenda', 'task-card'],
    allowedActions: ['task.complete', 'task.edit', 'task.reorder'],
    currentViewSummary: 'board with task cards, comfortable density',
  },
};

/**
 * Builds an injected `query` double that yields the given messages, and records
 * the prompt + options it was called with for assertions.
 */
function scriptedQuery(messages: AgentSdkMessage[]): {
  query: AgentSdkQuery;
  calls: { prompt: string; options?: AgentSdkQueryOptions }[];
} {
  const calls: { prompt: string; options?: AgentSdkQueryOptions }[] = [];
  const query: AgentSdkQuery = (args) => {
    const call: { prompt: string; options?: AgentSdkQueryOptions } = { prompt: args.prompt };
    if (args.options !== undefined) call.options = args.options;
    calls.push(call);
    async function* gen(): AsyncIterable<AgentSdkMessage> {
      for (const m of messages) yield m;
    }
    return gen();
  };
  return { query, calls };
}

/** A successful SDK run returning the given final text. */
function okResult(text: string): AgentSdkMessage[] {
  return [{ type: 'result', subtype: 'success', is_error: false, result: text }];
}

describe('AgentSdkInferenceAdapter — mapping', () => {
  it('is a REAL (non-simulated) adapter with a stable id', () => {
    const { query } = scriptedQuery(okResult('{}'));
    const adapter = new AgentSdkInferenceAdapter({ query });
    expect(adapter.simulated).toBe(false);
    expect(adapter.id).toBe('claude-agent-sdk');
  });

  it('parses a bare JSON proposal into the port response', async () => {
    const proposalJson = JSON.stringify({
      tokens: { density: 'compact', fontScale: 1.5 },
      components: [{ componentId: 'agenda' }, { componentId: 'task-card' }],
      controls: [{ controlId: 'task-complete-button' }],
      actions: ['task.complete'],
      rationale: 'Compact daily agenda.',
    });
    const { query } = scriptedQuery(okResult(proposalJson));
    const adapter = new AgentSdkInferenceAdapter({ query });

    const res = await adapter.propose(request);
    expect(res.simulated).toBe(false);
    expect(res.providerId).toBe('claude-agent-sdk');
    expect(res.proposal.tokens).toEqual({ density: 'compact', fontScale: 1.5 });
    expect(res.proposal.components).toEqual([
      { componentId: 'agenda' },
      { componentId: 'task-card' },
    ]);
    expect(res.proposal.controls).toEqual([{ controlId: 'task-complete-button' }]);
    expect(res.proposal.actions).toEqual(['task.complete']);
    expect(res.proposal.rationale).toBe('Compact daily agenda.');
  });

  it('tolerates prose/code fences around the JSON object', async () => {
    const text = 'Here is your proposal:\n```json\n{ "tokens": { "density": "compact" } }\n```\nDone.';
    const { query } = scriptedQuery(okResult(text));
    const adapter = new AgentSdkInferenceAdapter({ query });
    const res = await adapter.propose(request);
    expect(res.proposal.tokens).toEqual({ density: 'compact' });
  });

  it('keeps only well-formed proposal fields and drops malformed ones', async () => {
    const text = JSON.stringify({
      tokens: { density: 'compact', bad: { nested: true } }, // object value -> whole tokens dropped
      components: [{ componentId: 'agenda' }, { noId: true }], // one bad entry -> whole array dropped
      controls: [{ controlId: 'c1' }],
      actions: ['a', 2], // non-string -> dropped
      rationale: 42, // non-string -> dropped
      unknownField: 'ignored',
    });
    const { query } = scriptedQuery(okResult(text));
    const adapter = new AgentSdkInferenceAdapter({ query });
    const res = await adapter.propose(request);
    expect(res.proposal.tokens).toBeUndefined();
    expect(res.proposal.components).toBeUndefined();
    expect(res.proposal.controls).toEqual([{ controlId: 'c1' }]);
    expect(res.proposal.actions).toBeUndefined();
    expect(res.proposal.rationale).toBeUndefined();
    expect('unknownField' in res.proposal).toBe(false);
  });

  it('accepts an empty proposal object', async () => {
    const { query } = scriptedQuery(okResult('{}'));
    const adapter = new AgentSdkInferenceAdapter({ query });
    const res = await adapter.propose(request);
    expect(res.proposal).toEqual({});
  });
});

describe('AgentSdkInferenceAdapter — safety posture sent to the SDK', () => {
  it('constrains the query to a single, tool-less, settings-less turn', async () => {
    const { query, calls } = scriptedQuery(okResult('{}'));
    const adapter = new AgentSdkInferenceAdapter({ query, model: 'sonnet', effort: 'high' });
    await adapter.propose(request);

    expect(calls).toHaveLength(1);
    const opts = calls[0]!.options!;
    expect(opts.maxTurns).toBe(1);
    expect(opts.allowedTools).toEqual([]);
    expect(opts.disallowedTools).toEqual(['*']);
    expect(opts.settingSources).toEqual([]);
    expect(opts.model).toBe('sonnet');
    expect(opts.effort).toBe('high');
    expect(typeof opts.systemPrompt).toBe('string');
    expect(opts.abortController).toBeInstanceOf(AbortController);

    // The prompt carries the untrusted utterance and the allowed surface.
    const prompt = calls[0]!.prompt;
    expect(prompt).toContain('turn my board into a focused daily agenda');
    expect(prompt).toContain('board');
  });

  it('defaults to Claude Haiku (latest) at medium effort when not configured', async () => {
    const { query, calls } = scriptedQuery(okResult('{}'));
    const adapter = new AgentSdkInferenceAdapter({ query });
    await adapter.propose(request);
    const opts = calls[0]!.options!;
    expect(opts.model).toBe('haiku');
    expect(opts.effort).toBe('medium');
  });

  it('exposes the defaults as exported constants for easy later bumps', () => {
    expect(DEFAULT_MODEL).toBe('haiku');
    expect(DEFAULT_EFFORT).toBe('medium');
  });
});

describe('AgentSdkInferenceAdapter — failure -> typed InferenceError', () => {
  async function expectKind(messages: AgentSdkMessage[], kind: string): Promise<void> {
    const { query } = scriptedQuery(messages);
    const adapter = new AgentSdkInferenceAdapter({ query });
    await expect(adapter.propose(request)).rejects.toSatisfy(
      (e: unknown) => e instanceof InferenceError && e.kind === kind,
    );
  }

  it('maps authentication_failed (no/expired subscription login) -> auth', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'authentication_failed' } },
        { type: 'result', subtype: 'error_during_execution', is_error: true },
      ],
      'auth',
    );
  });

  it('maps oauth_org_not_allowed -> auth', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'oauth_org_not_allowed' } },
        { type: 'result', is_error: true },
      ],
      'auth',
    );
  });

  it('maps cloud_credential_error -> auth', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'cloud_credential_error' } },
        { type: 'result', is_error: true },
      ],
      'auth',
    );
  });

  it('maps billing_error -> quota', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'billing_error' } },
        { type: 'result', is_error: true },
      ],
      'quota',
    );
  });

  it('maps rate_limit -> rate-limit', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'rate_limit' } },
        { type: 'result', is_error: true },
      ],
      'rate-limit',
    );
  });

  it('maps overloaded (529) -> network', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'overloaded' } },
        { type: 'result', is_error: true },
      ],
      'network',
    );
  });

  it('maps server_error -> network', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'server_error' } },
        { type: 'result', is_error: true },
      ],
      'network',
    );
  });

  it('maps invalid_request / model_not_found -> invalid-response', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'model_not_found' } },
        { type: 'result', is_error: true },
      ],
      'invalid-response',
    );
  });

  it('maps an unknown SDK error code -> unknown', async () => {
    await expectKind(
      [
        { type: 'assistant', message: { error: 'something_new' } },
        { type: 'result', is_error: true },
      ],
      'unknown',
    );
  });

  it('uses the result subtype when no assistant error code is present', async () => {
    await expectKind([{ type: 'result', subtype: 'rate_limit', is_error: true }], 'rate-limit');
  });

  it('maps non-JSON model output -> invalid-response', async () => {
    await expectKind(okResult('I could not do that.'), 'invalid-response');
  });

  it('maps malformed JSON -> invalid-response', async () => {
    await expectKind(okResult('{ "tokens": '), 'invalid-response');
  });

  it('maps a JSON array (non-object) -> invalid-response', async () => {
    await expectKind(okResult('[1, 2, 3]'), 'invalid-response');
  });

  it('maps a stream that ends with no result message -> invalid-response', async () => {
    await expectKind([{ type: 'system' } as AgentSdkMessage], 'invalid-response');
  });

  it('classifies a thrown "not logged in" transport error -> auth', async () => {
    const query: AgentSdkQuery = () => {
      async function* gen(): AsyncIterable<AgentSdkMessage> {
        throw new Error('Not logged in: run `claude` to authenticate');
        yield { type: 'result' } as AgentSdkMessage; // unreachable
      }
      return gen();
    };
    const adapter = new AgentSdkInferenceAdapter({ query });
    await expect(adapter.propose(request)).rejects.toSatisfy(
      (e: unknown) => e instanceof InferenceError && e.kind === 'auth',
    );
  });

  it('classifies a thrown network error -> network', async () => {
    const query: AgentSdkQuery = () => {
      async function* gen(): AsyncIterable<AgentSdkMessage> {
        throw new Error('ECONNREFUSED fetch failed');
        yield { type: 'result' } as AgentSdkMessage; // unreachable
      }
      return gen();
    };
    const adapter = new AgentSdkInferenceAdapter({ query });
    await expect(adapter.propose(request)).rejects.toSatisfy(
      (e: unknown) => e instanceof InferenceError && e.kind === 'network',
    );
  });

  it('always surfaces an InferenceError (never a raw throw)', async () => {
    const query: AgentSdkQuery = () => {
      async function* gen(): AsyncIterable<AgentSdkMessage> {
        throw { weird: 'non-error-throw' };
        yield { type: 'result' } as AgentSdkMessage; // unreachable
      }
      return gen();
    };
    const adapter = new AgentSdkInferenceAdapter({ query });
    await expect(adapter.propose(request)).rejects.toBeInstanceOf(InferenceError);
  });
});

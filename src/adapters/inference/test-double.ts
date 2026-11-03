/**
 * Deterministic, LABELED test-double inference adapter.
 *
 * Honesty contract (steering 20-engineering): this is NOT the real agent. It always
 * reports `simulated: true` and `providerId: "test-double"` so callers can label
 * results accordingly. It exists so deterministic CI can exercise the full
 * request -> proposal -> validation -> ... flow with no network and no secrets.
 *
 * It deliberately produces proposals from simple, transparent keyword rules — it does
 * NOT perform natural-language understanding. The real understanding lives in the
 * Anthropic adapter (added later). Crucially, this double can also emit deliberately
 * *violating* proposals so tests can prove the validator rejects them.
 */

import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
} from '../../ports/inference.js';
import type { CustomizationProposal } from '../../domain/customization/types.js';

export interface TestDoubleScript {
  /**
   * Map of substring (matched case-insensitively against the utterance) to the
   * proposal that should be returned. First match wins, in insertion order.
   */
  readonly rules: ReadonlyArray<readonly [match: string, proposal: CustomizationProposal]>;
  /** Proposal returned when no rule matches. Defaults to an empty (no-op) proposal. */
  readonly fallback?: CustomizationProposal;
}

export class TestDoubleInferenceAdapter implements InferenceProvider {
  readonly id = 'test-double';
  readonly simulated = true;

  private readonly script: TestDoubleScript;

  constructor(script: TestDoubleScript) {
    this.script = script;
  }

  propose(request: InferenceRequest): Promise<InferenceResponse> {
    const utterance = request.utterance.toLowerCase();
    let proposal: CustomizationProposal = this.script.fallback ?? {};
    for (const [match, candidate] of this.script.rules) {
      if (utterance.includes(match.toLowerCase())) {
        proposal = candidate;
        break;
      }
    }
    return Promise.resolve({
      proposal,
      providerId: this.id,
      simulated: true,
    });
  }
}

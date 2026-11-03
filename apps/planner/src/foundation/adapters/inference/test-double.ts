/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/adapters/inference/test-double.ts).
 * Faithful copy of the foundation's LABELED test-double inference adapter.
 *
 * Honesty contract: this is NOT the real agent. It always reports `simulated: true`
 * and `providerId: "test-double"`. It produces proposals from simple keyword rules
 * and can emit deliberately violating proposals so tests prove the validator rejects.
 */

import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
} from '../../ports/inference.js';
import type { CustomizationProposal } from '../../domain/customization/types.js';

export interface TestDoubleScript {
  readonly rules: ReadonlyArray<readonly [match: string, proposal: CustomizationProposal]>;
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

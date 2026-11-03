/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/ports/inference.ts).
 * Faithful copy of the foundation's inference port. Consumed behind a port.
 */

import type { CustomizationProposal } from '../domain/customization/types.js';

/** Context handed to the provider so it can propose within the current surface. */
export interface InferenceRequest {
  readonly utterance: string;
  readonly surface: InferenceSurface;
}

export interface InferenceSurface {
  readonly overridableTokens: readonly string[];
  readonly allowedComponents: readonly string[];
  readonly allowedActions: readonly string[];
  readonly currentViewSummary: string;
}

export interface InferenceResponse {
  readonly proposal: CustomizationProposal;
  readonly providerId: string;
  /** True when produced by a test double / fallback, so callers can label it honestly. */
  readonly simulated: boolean;
}

/** Typed failure categories so callers can surface quota/auth/network honestly. */
export type InferenceErrorKind =
  | 'auth'
  | 'quota'
  | 'rate-limit'
  | 'network'
  | 'invalid-response'
  | 'unknown';

export class InferenceError extends Error {
  readonly kind: InferenceErrorKind;
  constructor(kind: InferenceErrorKind, message: string) {
    super(message);
    this.name = 'InferenceError';
    this.kind = kind;
  }
}

export interface InferenceProvider {
  readonly id: string;
  readonly simulated: boolean;
  propose(request: InferenceRequest): Promise<InferenceResponse>;
}

/**
 * Inference port (hexagonal). The host app depends on this interface, never on a
 * concrete provider. Adapters:
 *   - AnthropicAdapter    (real; @anthropic-ai/sdk) — added in a later PR
 *   - TestDoubleAdapter   (deterministic, labeled)  — src/adapters/inference/test-double.ts
 *   - OpenAI/Codex/...     (future)
 *
 * The provider turns an untrusted natural-language request into an untrusted
 * CustomizationProposal. The proposal is ALWAYS validated downstream; the provider is
 * never trusted to enforce policy.
 */

import type { CustomizationProposal } from '../domain/customization/types.js';

/** Context handed to the provider so it can propose within the current surface. */
export interface InferenceRequest {
  /** The end-user's natural-language request. Untrusted input. */
  readonly utterance: string;
  /**
   * A compact, non-sensitive description of what can be customized (allowed tokens,
   * component ids, current view summary). Never contains secrets or business data
   * beyond what is needed to propose a view change.
   */
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
  /** Identifies which adapter produced this (e.g. "anthropic", "test-double"). */
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
  /** True for test doubles / offline fallbacks. */
  readonly simulated: boolean;
  propose(request: InferenceRequest): Promise<InferenceResponse>;
}

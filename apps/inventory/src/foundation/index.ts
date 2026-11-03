/**
 * VENDORED public surface of the @taylor-made-labs/user-tailored-ui foundation.
 *
 * This mirrors the foundation's own `src/index.ts` PUBLIC entrypoint exactly. The
 * Inventory app adopts the foundation through THIS file and the ports only — it never
 * reaches into foundation internals. When the foundation is published to npm, this
 * directory is deleted and the single port in `src/ports/foundation.ts` re-points at
 * the pinned package; no app code changes (that is the point of the port seam).
 *
 * See PR body + src/ports/foundation.ts for the consumption contract.
 */

// Domain — customization boundary
export type {
  TokenValue,
  TokenSet,
  ComponentRef,
  ControlRef,
  ViewDescriptor,
  CustomizationProposal,
  UserPreferences,
} from './domain/customization/types.js';
export type {
  CreatorPolicy,
  TokenRule,
  NumberTokenRule,
  EnumTokenRule,
  BooleanTokenRule,
} from './domain/customization/policy.js';
export { InvariantKind } from './domain/customization/policy.js';
export {
  validateProposal,
  type ValidationResult,
  type RejectionReason,
} from './domain/customization/validator.js';
export {
  CustomizationOrchestrator,
  type OrchestratorDeps,
  type Preview,
  type ProposeOutcome,
} from './domain/customization/orchestrator.js';

// Ports
export type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceSurface,
  InferenceErrorKind,
} from './ports/inference.js';
export { InferenceError } from './ports/inference.js';
export type {
  CustomizationHistoryStore,
  HistoryScope,
  HistoryRef,
  SavedCustomization,
} from './ports/customization-history.js';
export type {
  UiCapability,
  CapabilityComponentSpec,
  RenderDescriptor,
} from './ports/ui-capability.js';

// Test-double adapters (labeled; safe to ship for demos/tests)
export {
  TestDoubleInferenceAdapter,
  type TestDoubleScript,
} from './adapters/inference/test-double.js';
export { InMemoryHistoryStore } from './adapters/history/in-memory.js';

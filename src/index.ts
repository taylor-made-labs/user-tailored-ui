/**
 * Public surface of the user-tailored-ui foundation.
 * Apps adopt the foundation through these exports and the ports; they do not reach
 * into internal modules.
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

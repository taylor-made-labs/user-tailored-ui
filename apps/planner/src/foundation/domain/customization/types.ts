/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/domain/customization/types.ts).
 *
 * This is a faithful copy of the foundation's PUBLIC surface only, pinned at the
 * foundation's current public API. Planner consumes it behind a port
 * (src/ports/foundation.ts) so it can later be swapped for a pinned npm dependency
 * once the foundation is published. Do NOT edit app logic into this file.
 *
 * Core customization-boundary types. The domain layer is pure: no React, no model,
 * no storage. Everything here is deterministically checkable so validation is the
 * real guarantee, independent of the (untrusted) model proposal.
 */

/**
 * A design token value the agent is allowed to propose. Intentionally a small,
 * enumerable set of primitives — NOT an open-ended style object.
 */
export type TokenValue = string | number | boolean;

/** A flat, validated bag of design tokens (e.g. `density`, `fontScale`). */
export type TokenSet = Readonly<Record<string, TokenValue>>;

/** A reference to an approved component by stable id. */
export interface ComponentRef {
  readonly componentId: string;
  /** Optional policy-constrained props (validated against the component contract). */
  readonly props?: Readonly<Record<string, TokenValue>>;
}

/** A named, operable control that a view may require to remain present. */
export interface ControlRef {
  readonly controlId: string;
}

/**
 * The resulting view description that validation inspects. Data, never code.
 */
export interface ViewDescriptor {
  readonly tokens: TokenSet;
  readonly components: readonly ComponentRef[];
  readonly controls: readonly ControlRef[];
  readonly actions: readonly string[];
}

/**
 * A proposal is the untrusted output of the agent (or a direct user preference edit).
 * A requested transformation of the current view, expressed only as data.
 */
export interface CustomizationProposal {
  readonly tokens?: TokenSet;
  readonly components?: readonly ComponentRef[];
  readonly controls?: readonly ControlRef[];
  readonly actions?: readonly string[];
  /** Free-text rationale for display only. NEVER trusted to relax validation. */
  readonly rationale?: string;
}

/** User preferences: overridable, within policy-allowed ranges. */
export interface UserPreferences {
  readonly tokens?: TokenSet;
}

/**
 * Core customization-boundary types.
 *
 * These model the three-layer precedence from
 * `.kiro/steering/10-customization-boundary.md`:
 *
 *     Creator Policy (trusted)  >  Defaults (trusted)  >  User Preferences (untrusted)
 *
 * The domain layer is pure: no React, no model, no storage. Everything here is
 * deterministically checkable so that validation is the real guarantee, independent
 * of the (untrusted) model proposal.
 */

/**
 * A design token value the agent is allowed to propose. Intentionally a small,
 * enumerable set of primitives — NOT an open-ended style object — so proposals are
 * the "simplest enforceable representation".
 */
export type TokenValue = string | number | boolean;

/** A flat, validated bag of design tokens (e.g. `density`, `fontScale`, `accent`). */
export type TokenSet = Readonly<Record<string, TokenValue>>;

/**
 * A reference to an approved component by stable id. The agent may only reference
 * components on the policy allow-list; it can never author or inject component code.
 */
export interface ComponentRef {
  readonly componentId: string;
  /** Optional policy-constrained props (validated against the component contract). */
  readonly props?: Readonly<Record<string, TokenValue>>;
}

/**
 * A named, operable control that a view may require to remain present (e.g. a
 * "complete task" button, or an "adjust stock" input). Identity is by stable id.
 */
export interface ControlRef {
  readonly controlId: string;
}

/**
 * The resulting view description that validation inspects. This is data, never code.
 * It is produced by applying a proposal to a base view; the validator checks both the
 * proposal AND this resulting view against the policy's invariants.
 */
export interface ViewDescriptor {
  /** Tokens currently in effect for the view. */
  readonly tokens: TokenSet;
  /** Components currently placed in the view, in order. */
  readonly components: readonly ComponentRef[];
  /** Controls currently present and operable in the view. */
  readonly controls: readonly ControlRef[];
  /** Domain actions this view exposes to the user (e.g. "task.complete"). */
  readonly actions: readonly string[];
}

/**
 * A proposal is the untrusted output of the agent (or a direct user preference edit).
 * It is a *requested* transformation of the current view, expressed only as data.
 */
export interface CustomizationProposal {
  /** Tokens to set/override. Only policy-allowed keys+values survive validation. */
  readonly tokens?: TokenSet;
  /** The desired ordered component set (allow-listed ids only). */
  readonly components?: readonly ComponentRef[];
  /** Controls the proposal intends the view to expose. */
  readonly controls?: readonly ControlRef[];
  /** Actions the proposal intends to enable. */
  readonly actions?: readonly string[];
  /**
   * Free-text rationale from the agent, for display only. NEVER trusted as
   * justification and NEVER used to relax validation.
   */
  readonly rationale?: string;
}

/**
 * User preferences: overridable, within policy-allowed ranges. Distinct from the
 * trusted Defaults and the trusted Policy. Preferences can only *select among*
 * policy-allowed options.
 */
export interface UserPreferences {
  readonly tokens?: TokenSet;
}

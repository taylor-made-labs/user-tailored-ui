/**
 * Creator Policy — the single, explicit, trusted, versioned definition that is
 * separate from defaults and user preferences (see steering 10-customization-boundary).
 *
 * The policy defines concrete, checkable INVARIANTS:
 *   - allowed actions
 *   - required controls
 *   - measurable visual limits (incl. accessibility + branding constraints)
 *   - which tokens are overridable, and within what ranges
 *
 * Invariants are enforced (violation => reject). Overridable token ranges express
 * preferences. Permissions/business rules are enforced in the domain, independent of
 * presentation, and are not representable as mere view tokens.
 */

import type { TokenValue } from './types.js';

/** A numeric token constrained to an inclusive range (a measurable visual limit). */
export interface NumberTokenRule {
  readonly kind: 'number';
  /** Inclusive minimum. Omit for unbounded below. */
  readonly min?: number;
  /** Inclusive maximum. Omit for unbounded above. */
  readonly max?: number;
}

/** A token constrained to an explicit set of allowed values. */
export interface EnumTokenRule {
  readonly kind: 'enum';
  readonly values: readonly TokenValue[];
}

/** A boolean token (on/off). */
export interface BooleanTokenRule {
  readonly kind: 'boolean';
}

export type TokenRule = NumberTokenRule | EnumTokenRule | BooleanTokenRule;

/**
 * The trusted policy. `version` is used to validate/migrate saved state on reopen
 * and rollback. Everything here is creator-owned and never writable by a proposal.
 */
export interface CreatorPolicy {
  /** Opaque policy version; saved customization state is tagged with this. */
  readonly version: string;

  /** Domain actions the creator permits a customized view to expose. */
  readonly allowedActions: readonly string[];

  /**
   * Controls that MUST remain present and operable in any valid view
   * (e.g. the control that completes a task, or adjusts stock).
   */
  readonly requiredControls: readonly string[];

  /**
   * Component allow-list. A proposal may only reference these component ids.
   */
  readonly allowedComponents: readonly string[];

  /**
   * Per-token rules. A token key absent from this map is NOT overridable and any
   * attempt to set it is a violation. A key present here is overridable within its
   * rule (a preference), and still validated.
   */
  readonly tokenRules: Readonly<Record<string, TokenRule>>;
}

/** Stable identifiers for the kinds of invariant a rejection can cite. */
export const InvariantKind = {
  DisallowedAction: 'disallowed-action',
  MissingRequiredControl: 'missing-required-control',
  DisallowedComponent: 'disallowed-component',
  UnknownToken: 'unknown-token',
  TokenOutOfRange: 'token-out-of-range',
  PolicyTampering: 'policy-tampering',
} as const;

export type InvariantKind = (typeof InvariantKind)[keyof typeof InvariantKind];

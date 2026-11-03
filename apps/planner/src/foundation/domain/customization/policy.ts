/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/domain/customization/policy.ts).
 * Faithful copy of the foundation's public policy surface. Consumed behind a port.
 *
 * Creator Policy — the single, explicit, trusted, versioned definition separate from
 * defaults and user preferences. Defines concrete, checkable INVARIANTS.
 */

import type { TokenValue } from './types.js';

/** A numeric token constrained to an inclusive range (a measurable visual limit). */
export interface NumberTokenRule {
  readonly kind: 'number';
  readonly min?: number;
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

/** The trusted policy. Creator-owned and never writable by a proposal. */
export interface CreatorPolicy {
  readonly version: string;
  readonly allowedActions: readonly string[];
  readonly requiredControls: readonly string[];
  readonly allowedComponents: readonly string[];
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

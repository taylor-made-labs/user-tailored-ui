/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/domain/customization/validator.ts).
 * Faithful copy of the foundation's deterministic validator. Consumed behind a port.
 *
 * It is independent of the model: given a trusted policy, a base view, and an
 * untrusted proposal, it produces the resulting view (if every invariant holds) or
 * a structured rejection citing the specific rule that failed.
 */

import { type CreatorPolicy, InvariantKind, type TokenRule } from './policy.js';
import type {
  ComponentRef,
  ControlRef,
  CustomizationProposal,
  TokenSet,
  TokenValue,
  ViewDescriptor,
} from './types.js';

/** A single reason a proposal was rejected, citing the offending rule. */
export interface RejectionReason {
  readonly invariant: InvariantKind;
  readonly subject: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly view: ViewDescriptor }
  | { readonly ok: false; readonly reasons: readonly RejectionReason[] };

/** Reserved token keys that, if present in a proposal, indicate policy-tampering intent. */
const POLICY_RESERVED_KEYS = new Set([
  'version',
  'allowedActions',
  'requiredControls',
  'allowedComponents',
  'tokenRules',
  '__proto__',
  'constructor',
  'prototype',
]);

function checkTokenValue(
  key: string,
  value: TokenValue,
  rule: TokenRule,
): RejectionReason | null {
  switch (rule.kind) {
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return {
          invariant: InvariantKind.TokenOutOfRange,
          subject: key,
          message: `Token "${key}" must be a number.`,
        };
      }
      if (rule.min !== undefined && value < rule.min) {
        return {
          invariant: InvariantKind.TokenOutOfRange,
          subject: key,
          message: `Token "${key}" (${value}) is below the allowed minimum of ${rule.min}.`,
        };
      }
      if (rule.max !== undefined && value > rule.max) {
        return {
          invariant: InvariantKind.TokenOutOfRange,
          subject: key,
          message: `Token "${key}" (${value}) exceeds the allowed maximum of ${rule.max}.`,
        };
      }
      return null;
    }
    case 'enum': {
      if (!rule.values.includes(value)) {
        return {
          invariant: InvariantKind.TokenOutOfRange,
          subject: key,
          message: `Token "${key}" (${String(value)}) is not one of the allowed values.`,
        };
      }
      return null;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return {
          invariant: InvariantKind.TokenOutOfRange,
          subject: key,
          message: `Token "${key}" must be a boolean.`,
        };
      }
      return null;
    }
  }
}

function mergeTokens(base: TokenSet, override: TokenSet | undefined): TokenSet {
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Validate a proposal against the policy and compute the resulting view.
 */
export function validateProposal(
  policy: CreatorPolicy,
  base: ViewDescriptor,
  proposal: CustomizationProposal,
): ValidationResult {
  const reasons: RejectionReason[] = [];

  // --- Tokens ---------------------------------------------------------------
  const proposedTokens = proposal.tokens ?? {};
  for (const key of Object.keys(proposedTokens)) {
    if (POLICY_RESERVED_KEYS.has(key)) {
      reasons.push({
        invariant: InvariantKind.PolicyTampering,
        subject: key,
        message: `Token "${key}" is reserved and cannot be set by a customization proposal.`,
      });
      continue;
    }
    const rule = policy.tokenRules[key];
    if (!rule) {
      reasons.push({
        invariant: InvariantKind.UnknownToken,
        subject: key,
        message: `Token "${key}" is not an overridable token under the current policy.`,
      });
      continue;
    }
    const value = proposedTokens[key] as TokenValue;
    const bad = checkTokenValue(key, value, rule);
    if (bad) reasons.push(bad);
  }

  // --- Components (allow-list) ---------------------------------------------
  const resultComponents: readonly ComponentRef[] =
    proposal.components ?? base.components;
  for (const comp of resultComponents) {
    if (!policy.allowedComponents.includes(comp.componentId)) {
      reasons.push({
        invariant: InvariantKind.DisallowedComponent,
        subject: comp.componentId,
        message: `Component "${comp.componentId}" is not on the approved component list.`,
      });
    }
  }

  // --- Actions (allow-list) -------------------------------------------------
  const resultActions: readonly string[] = proposal.actions ?? base.actions;
  for (const action of resultActions) {
    if (!policy.allowedActions.includes(action)) {
      reasons.push({
        invariant: InvariantKind.DisallowedAction,
        subject: action,
        message: `Action "${action}" is not permitted by the current policy.`,
      });
    }
  }

  // --- Required controls (must all be present in the RESULTING view) --------
  const resultControls: readonly ControlRef[] =
    proposal.controls ?? base.controls;
  const presentControlIds = new Set(resultControls.map((c) => c.controlId));
  for (const required of policy.requiredControls) {
    if (!presentControlIds.has(required)) {
      reasons.push({
        invariant: InvariantKind.MissingRequiredControl,
        subject: required,
        message: `Required control "${required}" must remain present and operable.`,
      });
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const view: ViewDescriptor = {
    tokens: mergeTokens(base.tokens, proposal.tokens),
    components: resultComponents,
    controls: resultControls,
    actions: resultActions,
  };
  return { ok: true, view };
}

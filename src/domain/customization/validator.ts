/**
 * Deterministic validator — the real enforcement guarantee.
 *
 * It is independent of the model: it takes a (trusted) policy, a base view, and an
 * (untrusted) proposal, and either produces the resulting view (if every invariant
 * holds) or a structured rejection citing the specific rule that failed.
 *
 * Contract (see steering 10-customization-boundary):
 *   - Validate BEFORE every activation, on the proposal AND the resulting view.
 *   - Proposals/preferences can NEVER modify policy, validators, or enforcement.
 *   - On rejection: explain, citing the relevant rule; keep a recoverable valid view.
 *   - Output is data only; nothing here executes proposal-supplied code.
 */

import {
  type CreatorPolicy,
  InvariantKind,
  type TokenRule,
} from './policy.js';
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
  /** The specific offending identifier (action, control, component, or token key). */
  readonly subject: string;
  /** Human-readable explanation suitable for display to the user. */
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly view: ViewDescriptor }
  | {
      readonly ok: false;
      readonly reasons: readonly RejectionReason[];
      /** Per-part verdicts, present when produced by validateProposalParts. */
      readonly parts?: readonly PartVerdict[];
    };

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
 *
 * @param policy  Trusted creator policy (never mutated or read from the proposal).
 * @param base    The current, known-valid view the proposal transforms.
 * @param proposal Untrusted proposal (from the agent or a direct preference edit).
 */
export function validateProposal(
  policy: CreatorPolicy,
  base: ViewDescriptor,
  proposal: CustomizationProposal,
): ValidationResult {
  const reasons: RejectionReason[] = [];

  // --- Tokens ---------------------------------------------------------------
  // Reject attempts to write policy-reserved / prototype-polluting keys outright.
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

  // All invariants hold — compute the resulting (validated) view.
  const view: ViewDescriptor = {
    tokens: mergeTokens(base.tokens, proposal.tokens),
    components: resultComponents,
    controls: resultControls,
    actions: resultActions,
  };
  return { ok: true, view };
}

// ---------------------------------------------------------------------------
// Partial apply (spec T2.5, A1): per-part verdicts.
// ---------------------------------------------------------------------------

/**
 * Verdict for one part of a proposal (one setting, component, action, or the control set).
 * `ruleId` is the invariant that failed; `message` is the plain sentence for the user.
 */
export interface PartVerdict {
  readonly kind: 'token' | 'component' | 'control' | 'action';
  readonly subject: string;
  readonly ok: boolean;
  readonly ruleId?: InvariantKind;
  readonly message?: string;
}

export type PartialValidationResult =
  | { readonly ok: true; readonly view: ViewDescriptor; readonly parts: readonly PartVerdict[] }
  | {
      readonly ok: false;
      readonly reasons: readonly RejectionReason[];
      readonly parts: readonly PartVerdict[];
    };

interface Part {
  readonly kind: PartVerdict['kind'];
  readonly subject: string;
  rejected?: RejectionReason;
}

/**
 * Validate a proposal part by part. Valid parts form the resulting view (applied
 * together as one step); invalid parts are rejected with their rule id and sentence.
 * Policy tampering rejects the WHOLE proposal. If no part is valid, or the valid parts
 * change nothing, the result is a rejection. The result view is re-validated as a whole
 * (fixpoint, bounded by part count) so no part can make another part invalid.
 * Pure and deterministic; nothing here executes proposal-supplied code.
 */
export function validateProposalParts(
  policy: CreatorPolicy,
  base: ViewDescriptor,
  proposal: CustomizationProposal,
): PartialValidationResult {
  const tokens = proposal.tokens ?? {};
  const tokenKeys = Object.keys(tokens);

  // Tampering: refuse the whole proposal, marking every part.
  if (tokenKeys.some((k) => POLICY_RESERVED_KEYS.has(k))) {
    const whole = validateProposal(policy, base, proposal);
    const reasons = whole.ok ? [] : whole.reasons;
    const refused = (kind: PartVerdict['kind'], subject: string): PartVerdict => {
      const t = reasons.find(
        (r) => r.invariant === InvariantKind.PolicyTampering && r.subject === subject,
      );
      return {
        kind,
        subject,
        ok: false,
        ruleId: InvariantKind.PolicyTampering,
        message:
          t?.message ??
          'Not applied: the whole request was refused because it tried to change the rules.',
      };
    };
    return {
      ok: false,
      reasons,
      parts: [
        ...tokenKeys.map((k) => refused('token', k)),
        ...(proposal.components ?? []).map((c) => refused('component', c.componentId)),
        ...(proposal.actions ?? []).map((a) => refused('action', a)),
      ],
    };
  }

  const parts: Part[] = [];
  const add = (p: Part): Part => {
    parts.push(p);
    return p;
  };
  const tokenParts = tokenKeys.map((key) => {
    const rule = policy.tokenRules[key];
    const rejected: RejectionReason | null = rule
      ? checkTokenValue(key, tokens[key] as TokenValue, rule)
      : {
          invariant: InvariantKind.UnknownToken,
          subject: key,
          message: `Token "${key}" is not an overridable token under the current policy.`,
        };
    return add({ kind: 'token', subject: key, ...(rejected ? { rejected } : {}) });
  });
  const compParts = (proposal.components ?? []).map((c) =>
    add({
      kind: 'component',
      subject: c.componentId,
      ...(policy.allowedComponents.includes(c.componentId)
        ? {}
        : {
            rejected: {
              invariant: InvariantKind.DisallowedComponent,
              subject: c.componentId,
              message: `Component "${c.componentId}" is not on the approved component list.`,
            },
          }),
    }),
  );
  const actionParts = (proposal.actions ?? []).map((a) =>
    add({
      kind: 'action',
      subject: a,
      ...(policy.allowedActions.includes(a)
        ? {}
        : {
            rejected: {
              invariant: InvariantKind.DisallowedAction,
              subject: a,
              message: `Action "${a}" is not permitted by the current policy.`,
            },
          }),
    }),
  );
  const controlParts: Part[] = [];
  if (proposal.controls) {
    const ids = new Set(proposal.controls.map((c) => c.controlId));
    const missing = policy.requiredControls.filter((r) => !ids.has(r));
    if (missing.length === 0) controlParts.push(add({ kind: 'control', subject: 'controls' }));
    for (const m of missing) {
      controlParts.push(
        add({
          kind: 'control',
          subject: m,
          rejected: {
            invariant: InvariantKind.MissingRequiredControl,
            subject: m,
            message: `Required control "${m}" must remain present and operable.`,
          },
        }),
      );
    }
  }

  // Build the candidate from accepted parts only; re-validate the whole result.
  const build = (): { view: ViewDescriptor | null; fail: readonly RejectionReason[] } => {
    const okTokens: Record<string, TokenValue> = {};
    for (const p of tokenParts) if (!p.rejected) okTokens[p.subject] = tokens[p.subject] as TokenValue;
    const comps = (proposal.components ?? []).filter((_, i) => !compParts[i]?.rejected);
    const acts = (proposal.actions ?? []).filter((_, i) => !actionParts[i]?.rejected);
    const controlsOk = proposal.controls !== undefined && controlParts.every((p) => !p.rejected);
    // If every proposed item was rejected, keep the base set rather than an empty one.
    const cand: CustomizationProposal = {
      tokens: okTokens,
      ...(proposal.components && (comps.length > 0 || proposal.components.length === 0)
        ? { components: comps }
        : {}),
      ...(proposal.actions && (acts.length > 0 || proposal.actions.length === 0)
        ? { actions: acts }
        : {}),
      ...(controlsOk ? { controls: proposal.controls as readonly ControlRef[] } : {}),
    };
    const res = validateProposal(policy, base, cand);
    return { view: res.ok ? res.view : null, fail: res.ok ? [] : res.reasons };
  };

  let built = build();
  for (let i = 0; i <= parts.length && built.view === null; i++) {
    // Reject any still-accepted part named by the whole-view failure; stop if none match.
    let changed = false;
    for (const r of built.fail) {
      for (const p of parts) {
        if (!p.rejected && p.subject === r.subject) {
          p.rejected = r;
          changed = true;
        }
      }
    }
    if (!changed) break;
    built = build();
  }

  const verdicts: PartVerdict[] = parts.map((p) =>
    p.rejected
      ? {
          kind: p.kind,
          subject: p.subject,
          ok: false,
          ruleId: p.rejected.invariant,
          message: p.rejected.message,
        }
      : { kind: p.kind, subject: p.subject, ok: true },
  );
  const rejectedReasons = parts.flatMap((p) => (p.rejected ? [p.rejected] : []));

  if (built.view === null) {
    return { ok: false, reasons: built.fail, parts: verdicts };
  }
  const applied = parts.length - rejectedReasons.length;
  if (
    rejectedReasons.length > 0 &&
    (applied === 0 || JSON.stringify(built.view) === JSON.stringify(base))
  ) {
    // Nothing valid to apply (or the valid parts change nothing): reject, keep the view.
    return { ok: false, reasons: rejectedReasons, parts: verdicts };
  }
  return { ok: true, view: built.view, parts: verdicts };
}

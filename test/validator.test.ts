import { describe, it, expect } from 'vitest';
import { validateProposal } from '../src/domain/customization/validator.js';
import { InvariantKind, type CreatorPolicy } from '../src/domain/customization/policy.js';
import type { ViewDescriptor } from '../src/domain/customization/types.js';

/** A representative policy covering every invariant kind. */
const policy: CreatorPolicy = {
  version: 'policy-1',
  allowedActions: ['task.complete', 'task.edit', 'task.reorder'],
  requiredControls: ['task-complete-button'],
  allowedComponents: ['board', 'agenda', 'task-card'],
  tokenRules: {
    density: { kind: 'enum', values: ['compact', 'comfortable'] },
    fontScale: { kind: 'number', min: 1, max: 2 },
    showConfetti: { kind: 'boolean' },
  },
};

const baseView: ViewDescriptor = {
  tokens: { density: 'comfortable', fontScale: 1 },
  components: [{ componentId: 'board' }, { componentId: 'task-card' }],
  controls: [{ controlId: 'task-complete-button' }],
  actions: ['task.complete', 'task.edit'],
};

describe('validator — passing cases (one per invariant)', () => {
  it('accepts an allowed action', () => {
    const r = validateProposal(policy, baseView, { actions: ['task.complete', 'task.reorder'] });
    expect(r.ok).toBe(true);
  });

  it('accepts a view that keeps the required control', () => {
    const r = validateProposal(policy, baseView, {
      controls: [{ controlId: 'task-complete-button' }],
    });
    expect(r.ok).toBe(true);
  });

  it('accepts an allow-listed component set', () => {
    const r = validateProposal(policy, baseView, {
      components: [{ componentId: 'agenda' }, { componentId: 'task-card' }],
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a known token within range', () => {
    const r = validateProposal(policy, baseView, { tokens: { fontScale: 1.5 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.view.tokens.fontScale).toBe(1.5);
  });

  it('accepts a known enum token value', () => {
    const r = validateProposal(policy, baseView, { tokens: { density: 'compact' } });
    expect(r.ok).toBe(true);
  });
});

describe('validator — violating cases (one per invariant)', () => {
  it('rejects a disallowed action', () => {
    const r = validateProposal(policy, baseView, { actions: ['task.delete'] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons[0]!.invariant).toBe(InvariantKind.DisallowedAction);
      expect(r.reasons[0]!.subject).toBe('task.delete');
    }
  });

  it('rejects removal of a required control', () => {
    const r = validateProposal(policy, baseView, { controls: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons[0]!.invariant).toBe(InvariantKind.MissingRequiredControl);
      expect(r.reasons[0]!.subject).toBe('task-complete-button');
    }
  });

  it('rejects a component not on the allow-list', () => {
    const r = validateProposal(policy, baseView, {
      components: [{ componentId: 'malicious-iframe' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.invariant).toBe(InvariantKind.DisallowedComponent);
  });

  it('rejects an unknown (non-overridable) token', () => {
    const r = validateProposal(policy, baseView, { tokens: { backgroundImage: 'evil.png' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.invariant).toBe(InvariantKind.UnknownToken);
  });

  it('rejects a numeric token out of range (visual-limit violation)', () => {
    const r = validateProposal(policy, baseView, { tokens: { fontScale: 5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons[0]!.invariant).toBe(InvariantKind.TokenOutOfRange);
      expect(r.reasons[0]!.message).toContain('maximum');
    }
  });

  it('rejects an out-of-set enum token value', () => {
    const r = validateProposal(policy, baseView, { tokens: { density: 'ultra' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.invariant).toBe(InvariantKind.TokenOutOfRange);
  });

  it('rejects attempts to modify policy/validation (reserved keys)', () => {
    const r = validateProposal(policy, baseView, {
      tokens: { allowedActions: 'task.delete' } as never,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.invariant).toBe(InvariantKind.PolicyTampering);
  });

  it('rejects prototype-pollution token keys', () => {
    const r = validateProposal(policy, baseView, {
      tokens: { ['__proto__']: 'x' } as never,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]!.invariant).toBe(InvariantKind.PolicyTampering);
  });
});

describe('validator — never mutates inputs', () => {
  it('leaves the base view untouched on rejection', () => {
    const snapshot = JSON.stringify(baseView);
    validateProposal(policy, baseView, { actions: ['task.delete'] });
    expect(JSON.stringify(baseView)).toBe(snapshot);
  });
});

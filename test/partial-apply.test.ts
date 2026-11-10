import { describe, it, expect } from 'vitest';
import { validateProposalParts, validateProposal } from '../src/domain/customization/validator.js';
import { InvariantKind, type CreatorPolicy } from '../src/domain/customization/policy.js';
import type { ViewDescriptor } from '../src/domain/customization/types.js';

const policy: CreatorPolicy = {
  version: 'policy-1',
  allowedActions: ['task.complete', 'task.edit', 'task.reorder'],
  requiredControls: ['task-complete-button'],
  allowedComponents: ['board', 'agenda', 'task-card'],
  tokenRules: {
    density: { kind: 'enum', values: ['compact', 'comfortable'] },
    fontScale: { kind: 'number', min: 1, max: 2 },
  },
};

const base: ViewDescriptor = {
  tokens: { density: 'comfortable', fontScale: 1 },
  components: [{ componentId: 'board' }, { componentId: 'task-card' }],
  controls: [{ controlId: 'task-complete-button' }],
  actions: ['task.complete', 'task.edit'],
};

describe('partial apply — mixed proposals', () => {
  it('applies the valid token and rejects the invalid one, naming the rule', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact', fontScale: 3 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.tokens).toEqual({ density: 'compact', fontScale: 1 });
    const bad = r.parts.find((p) => p.subject === 'fontScale');
    expect(bad).toMatchObject({ ok: false, ruleId: InvariantKind.TokenOutOfRange });
    expect(bad?.message).toMatch(/maximum of 2/);
    expect(r.parts.find((p) => p.subject === 'density')?.ok).toBe(true);
  });

  it('drops a disallowed component but keeps the allowed ones', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact' },
      components: [{ componentId: 'agenda' }, { componentId: 'banner-ad' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.components).toEqual([{ componentId: 'agenda' }]);
    expect(r.parts.find((p) => p.subject === 'banner-ad')?.ruleId).toBe(
      InvariantKind.DisallowedComponent,
    );
  });

  it('drops a disallowed action but keeps the allowed ones', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact' },
      actions: ['task.reorder', 'task.delete-all'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.actions).toEqual(['task.reorder']);
    expect(r.parts.find((p) => p.subject === 'task.delete-all')?.ruleId).toBe(
      InvariantKind.DisallowedAction,
    );
  });

  it('rejects a controls part that hides a required control; other parts apply', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact' },
      controls: [{ controlId: 'other' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.controls).toEqual(base.controls);
    expect(r.parts.find((p) => p.subject === 'task-complete-button')).toMatchObject({
      ok: false,
      ruleId: InvariantKind.MissingRequiredControl,
    });
  });

  it('applies unknown-token as rejected, not as an applied part', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact', sparkle: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.tokens).not.toHaveProperty('sparkle');
    expect(r.parts.find((p) => p.subject === 'sparkle')?.ruleId).toBe(InvariantKind.UnknownToken);
  });
});

describe('partial apply — nothing valid, nothing changes', () => {
  it('rejects when every part is invalid', () => {
    const r = validateProposalParts(policy, base, { tokens: { fontScale: 3 } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons[0]?.invariant).toBe(InvariantKind.TokenOutOfRange);
    expect(r.parts).toHaveLength(1);
  });

  it('rejects when the valid parts change nothing', () => {
    const r = validateProposalParts(policy, base, {
      components: [{ componentId: 'board' }, { componentId: 'task-card' }, { componentId: 'x' }],
    });
    expect(r.ok).toBe(false);
  });
});

describe('partial apply — guarantees kept', () => {
  it('policy tampering rejects the whole proposal, including valid parts', () => {
    const r = validateProposalParts(policy, base, {
      tokens: { density: 'compact', allowedActions: 'everything' },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.parts.every((p) => !p.ok && p.ruleId === InvariantKind.PolicyTampering)).toBe(true);
    expect(r.parts.map((p) => p.subject)).toContain('density');
  });

  it('an all-valid proposal matches the whole-proposal validator', () => {
    const proposal = { tokens: { density: 'compact' as const }, actions: ['task.reorder'] };
    const a = validateProposalParts(policy, base, proposal);
    const b = validateProposal(policy, base, proposal);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.view).toEqual(b.view);
  });

  it('property: any mix of parts yields a view that passes full validation', () => {
    const tokenOpts = [{}, { fontScale: 1.5 }, { fontScale: 9 }, { density: 'x' }, { nope: 1 }];
    const compOpts = [undefined, [{ componentId: 'agenda' }], [{ componentId: 'evil' }], [{ componentId: 'board' }, { componentId: 'evil' }]];
    const actOpts = [undefined, ['task.reorder'], ['rm'], ['task.edit', 'rm']];
    const ctlOpts = [undefined, [{ controlId: 'task-complete-button' }], [{ controlId: 'a' }]];
    for (const tokens of tokenOpts)
      for (const components of compOpts)
        for (const actions of actOpts)
          for (const controls of ctlOpts) {
            const r = validateProposalParts(policy, base, {
              tokens: tokens as never,
              ...(components ? { components } : {}),
              ...(actions ? { actions } : {}),
              ...(controls ? { controls } : {}),
            });
            if (!r.ok) continue;
            const full = validateProposal(policy, base, {
              tokens: r.view.tokens,
              components: r.view.components,
              controls: r.view.controls,
              actions: r.view.actions,
            });
            expect(full.ok).toBe(true);
          }
  });
});

/**
 * Foundation-integration tests (spec task 9; R2-R6).
 *
 * Drives the Planner's policy + views through the foundation orchestrator with the
 * labeled test-double agent and in-memory stores. Covers, per the steering contract,
 * a PASSING and a VIOLATING case for every enforced invariant class, plus
 * save/reopen/undo preserving tasks and the required complete control.
 */

import { describe, it, expect } from 'vitest';
import {
  InvariantKind,
  validateProposal,
  type CustomizationProposal,
} from '../src/ports/foundation.js';
import { plannerPolicy, PlannerControls } from '../src/customization/policy.js';
import {
  agendaProposal,
  defaultBoardView,
  violationProposals,
} from '../src/customization/views.js';
import { PlannerCustomization } from '../src/customization/service.js';
import { completeTask, createTask, type Task } from '../src/domain/task.js';
import { InMemoryTaskStore } from '../src/adapters/task-store-memory.js';

const stubNow = (): string => '2026-11-03T00:00:00.000Z';

describe('planner policy + defaults', () => {
  it('the default board view satisfies the policy (defaults must be valid)', () => {
    const res = validateProposal(plannerPolicy, defaultBoardView, {});
    expect(res.ok).toBe(true);
  });

  it('fontScale accessibility floor: 1 passes, below 1 is rejected', () => {
    const okRes = validateProposal(plannerPolicy, defaultBoardView, { tokens: { fontScale: 1 } });
    expect(okRes.ok).toBe(true);
    const badRes = validateProposal(plannerPolicy, defaultBoardView, { tokens: { fontScale: 0.5 } });
    expect(badRes.ok).toBe(false);
    if (!badRes.ok) expect(badRes.reasons[0]!.invariant).toBe(InvariantKind.TokenOutOfRange);
  });
});

describe('agenda transform (valid customization)', () => {
  it('previews and applies, preserving the complete control and task-card', () => {
    const cz = new PlannerCustomization({ userId: 'u1', now: stubNow });
    const outcome = cz.previewProposal(cz.defaults, agendaProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const view = outcome.preview.view;
    expect(view.components.map((c) => c.componentId)).toContain('agenda');
    expect(view.components.map((c) => c.componentId)).toContain('task-card');
    expect(view.controls.some((c) => c.controlId === PlannerControls.CompleteTask)).toBe(true);
    expect(view.tokens.density).toBe('compact');
    expect(outcome.preview.simulated).toBe(true);
  });

  it('the default offline agent produces the agenda from an utterance', async () => {
    const cz = new PlannerCustomization({ userId: 'u1', now: stubNow });
    const outcome = await cz.proposeFromUtterance(cz.defaults, 'turn this into a daily agenda');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.preview.simulated).toBe(true);
      expect(outcome.preview.providerId).toBe('test-double');
    }
  });
});

describe('the four violation classes all reject with a cited reason', () => {
  const cases: ReadonlyArray<[keyof typeof violationProposals, InvariantKind]> = [
    ['remove-complete-control', InvariantKind.MissingRequiredControl],
    ['font-scale-over-limit', InvariantKind.TokenOutOfRange],
    ['non-approved-component', InvariantKind.DisallowedComponent],
    ['disallowed-action', InvariantKind.DisallowedAction],
  ];

  for (const [id, expectedInvariant] of cases) {
    it(`${id} -> ${expectedInvariant}`, () => {
      const cz = new PlannerCustomization({ userId: 'u1', now: stubNow });
      const outcome = cz.previewProposal(cz.defaults, violationProposals[id], {
        simulated: true,
        providerId: 'test-double',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.result.reasons.some((r) => r.invariant === expectedInvariant)).toBe(true);
        expect(outcome.result.reasons[0]!.message.length).toBeGreaterThan(0);
      }
    });
  }

  it('a rejected proposal never mutates the base view (last valid view kept)', () => {
    const cz = new PlannerCustomization({ userId: 'u1', now: stubNow });
    const before = JSON.stringify(cz.defaults);
    cz.previewProposal(cz.defaults, violationProposals['disallowed-action'], {
      simulated: true,
      providerId: 'test-double',
    });
    expect(JSON.stringify(cz.defaults)).toBe(before);
  });

  it('policy-tampering tokens are rejected', () => {
    const tamper: CustomizationProposal = { tokens: { allowedActions: 'anything' } };
    const res = validateProposal(plannerPolicy, defaultBoardView, tamper);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons[0]!.invariant).toBe(InvariantKind.PolicyTampering);
  });
});

describe('save / reopen / undo (R5)', () => {
  it('applies agenda, reopens it under current policy, undoes to a prior valid view', async () => {
    const cz = new PlannerCustomization({ userId: 'u1', now: stubNow });

    const p = cz.previewProposal(cz.defaults, agendaProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const applied = await cz.apply(cz.defaults, p.preview.view, 'agenda');
    expect(applied.ok).toBe(true);

    const reopened = await cz.reopen();
    expect(reopened.usedFallback).toBe(false);
    expect(reopened.staleAgainstPolicy).toBe(false);
    expect(reopened.view.components.map((c) => c.componentId)).toContain('agenda');
    expect(reopened.view.controls.some((c) => c.controlId === PlannerControls.CompleteTask)).toBe(true);

    const refs = await cz.listHistory();
    expect(refs.length).toBeGreaterThan(0);
    const undone = await cz.undoTo(refs[refs.length - 1]!.id);
    expect(undone).not.toBeNull();
    expect(undone!.view.controls.some((c) => c.controlId === PlannerControls.CompleteTask)).toBe(true);
  });

  it('reopen with no saved state falls back to defaults', async () => {
    const cz = new PlannerCustomization({ userId: 'fresh', now: stubNow });
    const reopened = await cz.reopen();
    expect(reopened.usedFallback).toBe(true);
    expect(reopened.view).toEqual(defaultBoardView);
  });

  it('customization + undo never touch business task data', async () => {
    const userId = 'u1';
    const store = new InMemoryTaskStore();
    let tasks: readonly Task[] = [];
    tasks = createTask(tasks, { title: 'keep me' });
    tasks = completeTask(tasks, tasks[0]!.id, true);
    await store.save(userId, tasks);
    const idsBefore = tasks.map((t) => t.id).join(',');

    const cz = new PlannerCustomization({ userId, now: stubNow });
    const p = cz.previewProposal(cz.defaults, agendaProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    if (p.ok) await cz.apply(cz.defaults, p.preview.view, 'agenda');
    const refs = await cz.listHistory();
    if (refs[0]) await cz.undoTo(refs[0].id);

    const after = await store.load(userId);
    expect(after.map((t) => t.id).join(',')).toBe(idsBefore);
    expect(after[0]!.completed).toBe(true);
  });
});

describe('user separation', () => {
  it('two users do not share customization history', async () => {
    const a = new PlannerCustomization({ userId: 'alice', now: stubNow });
    const b = new PlannerCustomization({ userId: 'bob', now: stubNow });
    const p = a.previewProposal(a.defaults, agendaProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    if (p.ok) await a.apply(a.defaults, p.preview.view, 'agenda');
    // Separate service instances use separate in-memory stores; bob sees nothing.
    expect((await b.listHistory()).length).toBe(0);
  });

  it('a shared store keeps two users scoped apart', async () => {
    const store = new InMemoryTaskStore();
    await store.save('alice', [
      { id: 'a1', title: 'A', notes: '', completed: false, order: 0, createdAt: 't', updatedAt: 't' },
    ]);
    expect((await store.load('alice')).length).toBe(1);
    expect((await store.load('bob')).length).toBe(0);
  });
});

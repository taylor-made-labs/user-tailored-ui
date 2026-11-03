import { describe, it, expect } from 'vitest';
import { CustomizationOrchestrator } from '../src/domain/customization/orchestrator.js';
import { TestDoubleInferenceAdapter } from '../src/adapters/inference/test-double.js';
import { InMemoryHistoryStore } from '../src/adapters/history/in-memory.js';
import type { CreatorPolicy } from '../src/domain/customization/policy.js';
import type { ViewDescriptor } from '../src/domain/customization/types.js';
import type { HistoryScope } from '../src/ports/customization-history.js';

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

const defaultsView: ViewDescriptor = {
  tokens: { density: 'comfortable', fontScale: 1 },
  components: [{ componentId: 'board' }, { componentId: 'task-card' }],
  controls: [{ controlId: 'task-complete-button' }],
  actions: ['task.complete', 'task.edit', 'task.reorder'],
};

// A labeled test-double "agent": "focus"/"agenda" -> compact agenda view;
// "remove complete" -> an illegal proposal that strips the required control.
function makeAgent() {
  return new TestDoubleInferenceAdapter({
    rules: [
      [
        'agenda',
        {
          tokens: { density: 'compact' },
          components: [{ componentId: 'agenda' }, { componentId: 'task-card' }],
          rationale: 'Switched the board to a compact daily agenda.',
        },
      ],
      [
        'remove complete',
        { controls: [], rationale: 'Removing the complete button (should be rejected).' },
      ],
    ],
    fallback: {},
  });
}

function makeOrchestrator(history = new InMemoryHistoryStore()) {
  let t = 0;
  return new CustomizationOrchestrator({
    policy,
    inference: makeAgent(),
    history,
    appVersion: 'app-1',
    now: () => `2026-11-03T00:00:0${t++}.000Z`,
  });
}

const user: HistoryScope = { userId: 'user-a', appId: 'planner' };

describe('tracer bullet — full enforced flow', () => {
  it('request -> proposal -> validate -> preview -> apply -> save -> reopen -> undo', async () => {
    const orch = makeOrchestrator();

    // request -> proposal -> validation -> preview
    const outcome = await orch.proposeFromUtterance(defaultsView, 'make it a focused agenda');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.simulated).toBe(true); // honest labeling
    expect(outcome.preview.providerId).toBe('test-double');
    expect(outcome.preview.view.tokens.density).toBe('compact');

    // apply -> save
    const applied = await orch.applyAndSave(
      user,
      defaultsView,
      outcome.preview.view,
      'focus agenda',
    );
    expect('view' in applied && applied.ok === true).toBe(true);

    // reopen -> revalidates latest saved state under current policy
    const reopened = await orch.reopen(user, defaultsView);
    expect(reopened.usedFallback).toBe(false);
    expect(reopened.staleAgainstPolicy).toBe(false);
    expect(reopened.view.tokens.density).toBe('compact');

    // undo -> roll back to the first saved point, revalidated under current policy.
    // The in-memory store assigns ids h1, h2, ...; the first save is "h1".
    const undone = await orch.undoTo(user, 'h1', defaultsView);
    expect(undone).not.toBeNull();
    if (undone) {
      expect(undone.usedFallback).toBe(false);
      expect(undone.view.tokens.density).toBe('compact');
    }
  });

  it('rejects a violating proposal and preserves a recoverable valid view', async () => {
    const orch = makeOrchestrator();

    // First establish a known-good saved view.
    const good = await orch.proposeFromUtterance(defaultsView, 'make it a focused agenda');
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    await orch.applyAndSave(user, defaultsView, good.preview.view, 'focus agenda');

    // Now a violating request: strip the required control.
    const bad = await orch.proposeFromUtterance(good.preview.view, 'remove complete button');
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.result.reasons[0]!.invariant).toBe('missing-required-control');

    // The last valid view is still recoverable via reopen.
    const reopened = await orch.reopen(user, defaultsView);
    expect(reopened.view.controls.some((c) => c.controlId === 'task-complete-button')).toBe(true);
  });
});

describe('user separation + changed-policy rollback', () => {
  it('does not leak one user\'s customization to another', async () => {
    const orch = makeOrchestrator();
    const good = await orch.proposeFromUtterance(defaultsView, 'make it a focused agenda');
    if (!good.ok) return;
    await orch.applyAndSave({ userId: 'user-a', appId: 'planner' }, defaultsView, good.preview.view, 'a');

    const other = await orch.reopen({ userId: 'user-b', appId: 'planner' }, defaultsView);
    expect(other.usedFallback).toBe(true); // user-b has no state; falls back to defaults
    expect(other.view.tokens.density).toBe('comfortable');
  });

  it('falls back safely when saved state is invalid under current (changed) policy', async () => {
    // A shared store so the v2 orchestrator sees state saved under v1.
    const store = new InMemoryHistoryStore();

    // Save an 'agenda' view under the original policy.
    const orch = makeOrchestrator(store);
    const good = await orch.proposeFromUtterance(defaultsView, 'make it a focused agenda');
    if (!good.ok) return;
    await orch.applyAndSave(user, defaultsView, good.preview.view, 'a');

    // Now tighten policy: 'agenda' component is no longer allowed.
    const tightened: CreatorPolicy = {
      ...policy,
      version: 'policy-2',
      allowedComponents: ['board', 'task-card'],
    };
    const orchV2 = new CustomizationOrchestrator({
      policy: tightened,
      inference: makeAgent(),
      history: store,
      appVersion: 'app-1',
    });
    const reopened = await orchV2.reopen(user, defaultsView);
    expect(reopened.staleAgainstPolicy).toBe(true);
    expect(reopened.usedFallback).toBe(true); // agenda view invalid under policy-2
    expect(reopened.view.components.some((c) => c.componentId === 'board')).toBe(true);
  });
});

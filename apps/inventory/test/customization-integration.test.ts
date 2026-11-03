/**
 * Foundation-integration tests.
 *
 * Drives the Inventory's policy + views through the foundation orchestrator with the
 * labeled test-double agent and in-memory stores. Covers, per the steering contract,
 * a PASSING and a VIOLATING case for every enforced invariant class, plus
 * save/reopen/undo preserving items and the required adjust-qty control.
 */

import { describe, it, expect } from 'vitest';
import {
  InvariantKind,
  validateProposal,
  type CustomizationProposal,
} from '../src/ports/foundation.js';
import { inventoryPolicy, InventoryControls } from '../src/customization/policy.js';
import {
  defaultGridView,
  lowStockFocusProposal,
  violationProposals,
} from '../src/customization/views.js';
import { InventoryCustomization } from '../src/customization/service.js';
import { adjustQty, createItem, type Item } from '../src/domain/item.js';
import { InMemoryItemStore } from '../src/adapters/item-store-memory.js';

const stubNow = (): string => '2026-11-03T00:00:00.000Z';

describe('inventory policy + defaults', () => {
  it('the default grid view satisfies the policy (defaults must be valid)', () => {
    const res = validateProposal(inventoryPolicy, defaultGridView, {});
    expect(res.ok).toBe(true);
  });

  it('fontScale accessibility floor: 1 passes, below 1 is rejected', () => {
    const okRes = validateProposal(inventoryPolicy, defaultGridView, { tokens: { fontScale: 1 } });
    expect(okRes.ok).toBe(true);
    const badRes = validateProposal(inventoryPolicy, defaultGridView, { tokens: { fontScale: 0.5 } });
    expect(badRes.ok).toBe(false);
    if (!badRes.ok) expect(badRes.reasons[0]!.invariant).toBe(InvariantKind.TokenOutOfRange);
  });
});

describe('low-stock focus transform (valid customization)', () => {
  it('previews and applies, preserving the adjust-qty control and item-card', () => {
    const cz = new InventoryCustomization({ userId: 'u1', now: stubNow });
    const outcome = cz.previewProposal(cz.defaults, lowStockFocusProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const view = outcome.preview.view;
    expect(view.components.map((c) => c.componentId)).toContain('low-stock-view');
    expect(view.components.map((c) => c.componentId)).toContain('item-card');
    expect(view.controls.some((c) => c.controlId === InventoryControls.AdjustQty)).toBe(true);
    expect(view.tokens.lowStockOnly).toBe(true);
    expect(view.tokens.density).toBe('compact');
    expect(outcome.preview.simulated).toBe(true);
  });

  it('the default offline agent produces the low-stock focus from an utterance', async () => {
    const cz = new InventoryCustomization({ userId: 'u1', now: stubNow });
    const outcome = await cz.proposeFromUtterance(cz.defaults, 'focus on low stock to reorder');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.preview.simulated).toBe(true);
      expect(outcome.preview.providerId).toBe('test-double');
      expect(outcome.preview.view.tokens.lowStockOnly).toBe(true);
    }
  });
});

describe('the four violation classes all reject with a cited reason', () => {
  const cases: ReadonlyArray<[keyof typeof violationProposals, InvariantKind]> = [
    ['remove-adjust-control', InvariantKind.MissingRequiredControl],
    ['font-scale-over-limit', InvariantKind.TokenOutOfRange],
    ['non-approved-component', InvariantKind.DisallowedComponent],
    ['disallowed-action', InvariantKind.DisallowedAction],
  ];

  for (const [id, expectedInvariant] of cases) {
    it(`${id} -> ${expectedInvariant}`, () => {
      const cz = new InventoryCustomization({ userId: 'u1', now: stubNow });
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
    const cz = new InventoryCustomization({ userId: 'u1', now: stubNow });
    const before = JSON.stringify(cz.defaults);
    cz.previewProposal(cz.defaults, violationProposals['disallowed-action'], {
      simulated: true,
      providerId: 'test-double',
    });
    expect(JSON.stringify(cz.defaults)).toBe(before);
  });

  it('policy-tampering tokens are rejected', () => {
    const tamper: CustomizationProposal = { tokens: { allowedActions: 'anything' } };
    const res = validateProposal(inventoryPolicy, defaultGridView, tamper);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons[0]!.invariant).toBe(InvariantKind.PolicyTampering);
  });
});

describe('save / reopen / undo', () => {
  it('applies low-stock focus, reopens it under current policy, undoes to a prior valid view', async () => {
    const cz = new InventoryCustomization({ userId: 'u1', now: stubNow });

    const p = cz.previewProposal(cz.defaults, lowStockFocusProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const applied = await cz.apply(cz.defaults, p.preview.view, 'low-stock focus');
    expect(applied.ok).toBe(true);

    const reopened = await cz.reopen();
    expect(reopened.usedFallback).toBe(false);
    expect(reopened.staleAgainstPolicy).toBe(false);
    expect(reopened.view.components.map((c) => c.componentId)).toContain('low-stock-view');
    expect(reopened.view.controls.some((c) => c.controlId === InventoryControls.AdjustQty)).toBe(true);

    const refs = await cz.listHistory();
    expect(refs.length).toBeGreaterThan(0);
    const undone = await cz.undoTo(refs[refs.length - 1]!.id);
    expect(undone).not.toBeNull();
    expect(undone!.view.controls.some((c) => c.controlId === InventoryControls.AdjustQty)).toBe(true);
  });

  it('reopen with no saved state falls back to defaults', async () => {
    const cz = new InventoryCustomization({ userId: 'fresh', now: stubNow });
    const reopened = await cz.reopen();
    expect(reopened.usedFallback).toBe(true);
    expect(reopened.view).toEqual(defaultGridView);
  });

  it('customization + undo never touch business item data', async () => {
    const userId = 'u1';
    const store = new InMemoryItemStore();
    let items: readonly Item[] = [];
    items = createItem(items, { name: 'keep me', quantity: 5, lowStockThreshold: 2 });
    items = adjustQty(items, items[0]!.id, -1); // 5 -> 4
    await store.save(userId, items);
    const idsBefore = items.map((t) => t.id).join(',');

    const cz = new InventoryCustomization({ userId, now: stubNow });
    const p = cz.previewProposal(cz.defaults, lowStockFocusProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    if (p.ok) await cz.apply(cz.defaults, p.preview.view, 'low-stock focus');
    const refs = await cz.listHistory();
    if (refs[0]) await cz.undoTo(refs[0].id);

    const after = await store.load(userId);
    expect(after.map((t) => t.id).join(',')).toBe(idsBefore);
    expect(after[0]!.quantity).toBe(4);
  });
});

describe('user separation', () => {
  it('two users do not share customization history', async () => {
    const a = new InventoryCustomization({ userId: 'alice', now: stubNow });
    const b = new InventoryCustomization({ userId: 'bob', now: stubNow });
    const p = a.previewProposal(a.defaults, lowStockFocusProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    if (p.ok) await a.apply(a.defaults, p.preview.view, 'low-stock focus');
    // Separate service instances use separate in-memory stores; bob sees nothing.
    expect((await b.listHistory()).length).toBe(0);
  });

  it('a shared store keeps two users scoped apart', async () => {
    const store = new InMemoryItemStore();
    await store.save('alice', [
      {
        id: 'a1',
        name: 'A',
        quantity: 1,
        location: '',
        lowStockThreshold: 0,
        createdAt: 't',
        updatedAt: 't',
      },
    ]);
    expect((await store.load('alice')).length).toBe(1);
    expect((await store.load('bob')).length).toBe(0);
  });
});

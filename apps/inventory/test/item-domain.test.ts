/**
 * Inventory domain unit tests: pure item ops + identity stability + qty clamping.
 */

import { describe, it, expect } from 'vitest';
import {
  adjustQty,
  createItem,
  deleteItem,
  editItem,
  isLowStock,
  sortItems,
  type DomainClock,
  type Item,
} from '../src/domain/item.js';

function stubClock(): DomainClock {
  let n = 0;
  return {
    now: () => `2026-11-03T00:00:${String(n).padStart(2, '0')}.000Z`,
    newId: () => `i_${++n}`,
  };
}

function build(
  specs: ReadonlyArray<{ name: string; quantity?: number; lowStockThreshold?: number }>,
  clock: DomainClock,
): readonly Item[] {
  let items: readonly Item[] = [];
  for (const s of specs) items = createItem(items, s, clock);
  return items;
}

describe('item domain', () => {
  it('creates items with stable unique ids and non-negative counts', () => {
    const clock = stubClock();
    const items = build([{ name: 'a', quantity: 3 }, { name: 'b' }, { name: 'c', quantity: -2 }], clock);
    expect(items.map((t) => t.name)).toEqual(['a', 'b', 'c']);
    expect(items.map((t) => t.quantity)).toEqual([3, 0, 0]); // defaulted/clamped
    expect(new Set(items.map((t) => t.id)).size).toBe(3);
  });

  it('rejects an empty name on create and edit', () => {
    const clock = stubClock();
    expect(() => createItem([], { name: '   ' }, clock)).toThrow();
    const items = build([{ name: 'a' }], clock);
    expect(() => editItem(items, items[0]!.id, { name: '' }, clock)).toThrow();
  });

  it('edits descriptive fields without changing identity or quantity', () => {
    const clock = stubClock();
    const items = build([{ name: 'a', quantity: 7 }], clock);
    const id = items[0]!.id;
    const edited = editItem(items, id, { name: 'A!', location: 'bin-9', lowStockThreshold: 2 }, clock);
    const it = edited.find((x) => x.id === id)!;
    expect(it.id).toBe(id);
    expect(it.name).toBe('A!');
    expect(it.location).toBe('bin-9');
    expect(it.lowStockThreshold).toBe(2);
    expect(it.quantity).toBe(7); // quantity is not editable here
  });

  it('adjustQty moves by a signed delta and clamps at 0', () => {
    const clock = stubClock();
    const items = build([{ name: 'a', quantity: 2 }], clock);
    const id = items[0]!.id;
    const up = adjustQty(items, id, 5, clock);
    expect(up[0]!.quantity).toBe(7);
    const down = adjustQty(up, id, -100, clock);
    expect(down[0]!.quantity).toBe(0); // clamped, never negative
    expect(down[0]!.id).toBe(id);
  });

  it('adjustQty by a no-op delta returns the item unchanged (already at 0)', () => {
    const clock = stubClock();
    const items = build([{ name: 'a', quantity: 0 }], clock);
    const same = adjustQty(items, items[0]!.id, -3, clock);
    expect(same[0]!.quantity).toBe(0);
    expect(same[0]!.updatedAt).toBe(items[0]!.updatedAt);
  });

  it('deletes an item and preserves the identities of the rest', () => {
    const clock = stubClock();
    const items = build([{ name: 'a' }, { name: 'b' }, { name: 'c' }], clock);
    const keep = new Set([items[0]!.id, items[2]!.id]);
    const after = deleteItem(items, items[1]!.id);
    expect(after.map((t) => t.name)).toEqual(['a', 'c']);
    expect(after.every((t) => keep.has(t.id))).toBe(true);
  });

  it('isLowStock is true at or below threshold', () => {
    const clock = stubClock();
    const items = build([{ name: 'a', quantity: 3, lowStockThreshold: 3 }, { name: 'b', quantity: 4, lowStockThreshold: 3 }], clock);
    expect(isLowStock(items[0]!)).toBe(true); // 3 <= 3
    expect(isLowStock(items[1]!)).toBe(false); // 4 > 3
  });

  it('keeps every item identity stable across a full op sequence', () => {
    const clock = stubClock();
    let items = build([{ name: 'a', quantity: 1 }, { name: 'b', quantity: 1 }, { name: 'c', quantity: 1 }], clock);
    const ids = sortItems(items).map((t) => t.id);
    items = adjustQty(items, items[0]!.id, 4, clock);
    items = editItem(items, items[1]!.id, { name: 'B2' }, clock);
    items = adjustQty(items, items[2]!.id, -10, clock);
    const idsAfter = sortItems(items).map((t) => t.id).sort();
    expect([...ids].sort()).toEqual(idsAfter);
  });

  it('throws on operations against an unknown id', () => {
    const clock = stubClock();
    const items = build([{ name: 'a' }], clock);
    expect(() => editItem(items, 'nope', { name: 'x' }, clock)).toThrow();
    expect(() => adjustQty(items, 'nope', 1, clock)).toThrow();
    expect(() => deleteItem(items, 'nope')).toThrow();
  });
});

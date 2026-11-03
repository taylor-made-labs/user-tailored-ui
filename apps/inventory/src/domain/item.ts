/**
 * Inventory DOMAIN — the pure business workflow.
 *
 * An `Item` entity plus pure create / edit / adjustQty / delete operations. This
 * layer has NO dependency on React, the model, or storage. It is deterministic and
 * unit-testable, and it is the sole authority on item IDENTITY STABILITY: an item's
 * `id` is assigned once at creation and is never changed by any operation here or by
 * any customization. Every operation returns NEW immutable values (no mutation),
 * which makes identity stability easy to assert in tests.
 *
 * Distinct from the Planner's task domain: items carry a numeric `quantity`, a
 * `location` (category/aisle), and a `lowStockThreshold`. `adjustQty` moves the
 * quantity by a signed delta and is CLAMPED at 0 — stock never goes negative.
 */

/** A single inventory item. Identity is `id`, stable for the item's whole lifetime. */
export interface Item {
  /** Stable, unique identity. Never changes after creation. */
  readonly id: string;
  readonly name: string;
  /** On-hand count. Never negative (adjustQty clamps at 0). */
  readonly quantity: number;
  /** Where the item lives — an aisle, bin, or category label. */
  readonly location: string;
  /** At or below this count the item is "low stock". Never negative. */
  readonly lowStockThreshold: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Injectable clock + id source so domain ops stay pure and deterministic in tests. */
export interface DomainClock {
  now(): string;
  newId(): string;
}

/** Default clock: ISO timestamps + crypto-random ids (used outside tests). */
export const systemClock: DomainClock = {
  now: () => new Date().toISOString(),
  newId: () => `i_${globalThis.crypto.randomUUID()}`,
};

/** Fields a caller may supply when creating an item. */
export interface CreateItemInput {
  readonly name: string;
  readonly quantity?: number;
  readonly location?: string;
  readonly lowStockThreshold?: number;
}

/** Fields a caller may edit. Identity (`id`) and `quantity` are NOT editable here. */
export interface EditItemInput {
  readonly name?: string;
  readonly location?: string;
  readonly lowStockThreshold?: number;
}

/** Coerce a value to a safe non-negative integer count. */
function toCount(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  const floored = Math.floor(value);
  return floored < 0 ? 0 : floored;
}

/**
 * Create an item, appended to the current list. The new item gets a fresh stable id;
 * quantity and threshold default to 0 and are clamped non-negative.
 */
export function createItem(
  items: readonly Item[],
  input: CreateItemInput,
  clock: DomainClock = systemClock,
): readonly Item[] {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error('Item name must not be empty.');
  }
  const ts = clock.now();
  const item: Item = {
    id: clock.newId(),
    name,
    quantity: toCount(input.quantity ?? 0, 'quantity'),
    location: input.location?.trim() ?? '',
    lowStockThreshold: toCount(input.lowStockThreshold ?? 0, 'lowStockThreshold'),
    createdAt: ts,
    updatedAt: ts,
  };
  return [...items, item];
}

/** Edit an item's descriptive fields. Identity and quantity are untouched. */
export function editItem(
  items: readonly Item[],
  id: string,
  input: EditItemInput,
  clock: DomainClock = systemClock,
): readonly Item[] {
  return mapItem(items, id, (it) => {
    const nextName = input.name !== undefined ? input.name.trim() : it.name;
    if (nextName.length === 0) {
      throw new Error('Item name must not be empty.');
    }
    return {
      ...it,
      name: nextName,
      location: input.location !== undefined ? input.location.trim() : it.location,
      lowStockThreshold:
        input.lowStockThreshold !== undefined
          ? toCount(input.lowStockThreshold, 'lowStockThreshold')
          : it.lowStockThreshold,
      updatedAt: clock.now(),
    };
  });
}

/**
 * Adjust an item's quantity by a signed `delta`. The result is CLAMPED at 0 so stock
 * never goes negative. Identity, name, location, and threshold are untouched. A delta
 * that does not change the clamped quantity returns the item unchanged.
 */
export function adjustQty(
  items: readonly Item[],
  id: string,
  delta: number,
  clock: DomainClock = systemClock,
): readonly Item[] {
  if (!Number.isFinite(delta)) {
    throw new Error('Quantity delta must be a finite number.');
  }
  return mapItem(items, id, (it) => {
    const next = Math.max(0, Math.floor(it.quantity + delta));
    return next === it.quantity ? it : { ...it, quantity: next, updatedAt: clock.now() };
  });
}

/** Delete the item with `id`. Throws if the id is unknown. Other items untouched. */
export function deleteItem(items: readonly Item[], id: string): readonly Item[] {
  if (!items.some((it) => it.id === id)) {
    throw new Error(`Unknown item "${id}".`);
  }
  return items.filter((it) => it.id !== id);
}

/** True when an item is at or below its low-stock threshold. */
export function isLowStock(item: Item): boolean {
  return item.quantity <= item.lowStockThreshold;
}

/** Return items sorted by name (ascending), stable on ties by `createdAt`. */
export function sortItems(items: readonly Item[]): readonly Item[] {
  return [...items].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.createdAt.localeCompare(b.createdAt);
  });
}

/** Apply `fn` to the item whose id matches; throws if the id is unknown. */
function mapItem(
  items: readonly Item[],
  id: string,
  fn: (it: Item) => Item,
): readonly Item[] {
  let found = false;
  const next = items.map((it) => {
    if (it.id !== id) return it;
    found = true;
    return fn(it);
  });
  if (!found) {
    throw new Error(`Unknown item "${id}".`);
  }
  return next;
}

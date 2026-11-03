/**
 * In-memory business-persistence adapter for items (test double).
 *
 * Deterministic, no IndexedDB — used by the Node test suite to exercise the item
 * workflow and prove user separation (items are keyed strictly by userId and never
 * leak across users). Mirrors the IndexedDB adapter's contract exactly.
 */

import type { Item } from '../domain/item.js';
import type { ItemStore } from '../ports/item-store.js';

export class InMemoryItemStore implements ItemStore {
  private readonly byUser = new Map<string, readonly Item[]>();

  load(userId: string): Promise<readonly Item[]> {
    return Promise.resolve(this.byUser.get(userId) ?? []);
  }

  save(userId: string, items: readonly Item[]): Promise<void> {
    // Snapshot copy so later domain operations cannot mutate stored state.
    this.byUser.set(userId, items.map((it) => ({ ...it })));
    return Promise.resolve();
  }
}

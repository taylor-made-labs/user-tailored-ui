/**
 * Business-persistence port for ITEMS.
 *
 * Items are the persistent BUSINESS workflow. This store is kept strictly SEPARATE
 * from customization history (the foundation's `CustomizationHistoryStore`): they
 * never share a store, a key space, or a transaction. Neither localStorage nor
 * chrome.storage is used — the concrete adapter is IndexedDB only.
 *
 * Scoped by userId so different users' items never mix (user separation).
 */

import type { Item } from '../domain/item.js';

export interface ItemStore {
  /** Load all items for a user (unordered; callers sort via the domain). */
  load(userId: string): Promise<readonly Item[]>;
  /** Persist the full item list for a user, replacing the prior snapshot. */
  save(userId: string, items: readonly Item[]): Promise<void>;
}

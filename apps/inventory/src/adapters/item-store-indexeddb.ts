/**
 * IndexedDB business-persistence adapter for items.
 *
 * Storage is IndexedDB ONLY (steering) — never localStorage, never chrome.storage.
 * One object store (`items`) keyed by userId holds each user's item snapshot. This
 * database is DISTINCT from any customization-history store: business data and
 * customization state are never mixed (different DB name, different store).
 *
 * This adapter runs in the browser. The deterministic Node test suite uses the
 * in-memory `InMemoryItemStore` instead (IndexedDB is not present under vitest/node),
 * so this file is intentionally not imported by any test.
 */

import type { Item } from '../domain/item.js';
import type { ItemStore } from '../ports/item-store.js';

const DB_NAME = 'inventory-business';
const DB_VERSION = 1;
const STORE = 'items';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // Keyed explicitly by userId (no in-record keyPath).
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export class IndexedDbItemStore implements ItemStore {
  async load(userId: string): Promise<readonly Item[]> {
    const db = await openDb();
    try {
      return await new Promise<readonly Item[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(userId);
        req.onsuccess = () => {
          const value = req.result as Item[] | undefined;
          resolve(value ?? []);
        };
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  async save(userId: string, items: readonly Item[]): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        // Store a plain snapshot copy (structured-cloneable).
        tx.objectStore(STORE).put(items.map((it) => ({ ...it })), userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      });
    } finally {
      db.close();
    }
  }
}

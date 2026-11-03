/**
 * IndexedDB business-persistence adapter for tasks (spec task 3, R1).
 *
 * Storage is IndexedDB ONLY (steering 20-engineering) — never localStorage, never
 * chrome.storage. One object store (`tasks`) keyed by userId holds each user's task
 * snapshot. This database is DISTINCT from any customization-history store: business
 * data and customization state are never mixed.
 *
 * This adapter runs in the browser. The deterministic Node test suite uses the
 * in-memory `InMemoryTaskStore` instead (IndexedDB is not present under vitest/node),
 * so this file is intentionally not imported by any test.
 */

import type { Task } from '../domain/task.js';
import type { TaskStore } from '../ports/task-store.js';

const DB_NAME = 'planner-business';
const DB_VERSION = 1;
const STORE = 'tasks';

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

export class IndexedDbTaskStore implements TaskStore {
  async load(userId: string): Promise<readonly Task[]> {
    const db = await openDb();
    try {
      return await new Promise<readonly Task[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(userId);
        req.onsuccess = () => {
          const value = req.result as Task[] | undefined;
          resolve(value ?? []);
        };
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  async save(userId: string, tasks: readonly Task[]): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        // Store a plain snapshot copy (structured-cloneable).
        tx.objectStore(STORE).put(tasks.map((t) => ({ ...t })), userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      });
    } finally {
      db.close();
    }
  }
}

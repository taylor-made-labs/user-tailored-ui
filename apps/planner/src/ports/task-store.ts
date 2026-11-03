/**
 * Business-persistence port for TASKS (spec task 3, R1).
 *
 * Tasks are the persistent BUSINESS workflow. This store is kept strictly SEPARATE
 * from customization history (the foundation's `CustomizationHistoryStore`): they
 * never share a store, a key space, or a transaction. Neither localStorage nor
 * chrome.storage is used — the concrete adapter is IndexedDB only.
 *
 * Scoped by userId so different users' tasks never mix (user separation).
 */

import type { Task } from '../domain/task.js';

export interface TaskStore {
  /** Load all tasks for a user (unordered; callers sort via the domain). */
  load(userId: string): Promise<readonly Task[]>;
  /** Persist the full task list for a user, replacing the prior snapshot. */
  save(userId: string, tasks: readonly Task[]): Promise<void>;
}

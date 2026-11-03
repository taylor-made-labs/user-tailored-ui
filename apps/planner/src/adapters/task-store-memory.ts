/**
 * In-memory business-persistence adapter for tasks (test double).
 *
 * Deterministic, no IndexedDB — used by the Node test suite to exercise the task
 * workflow and prove user separation (tasks are keyed strictly by userId and never
 * leak across users). Mirrors the IndexedDB adapter's contract exactly.
 */

import type { Task } from '../domain/task.js';
import type { TaskStore } from '../ports/task-store.js';

export class InMemoryTaskStore implements TaskStore {
  private readonly byUser = new Map<string, readonly Task[]>();

  load(userId: string): Promise<readonly Task[]> {
    return Promise.resolve(this.byUser.get(userId) ?? []);
  }

  save(userId: string, tasks: readonly Task[]): Promise<void> {
    // Snapshot copy so later domain operations cannot mutate stored state.
    this.byUser.set(userId, tasks.map((t) => ({ ...t })));
    return Promise.resolve();
  }
}

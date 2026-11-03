/**
 * Planner DOMAIN — the pure business workflow (spec task 1, R1).
 *
 * A `Task` entity plus pure create/edit/reorder/complete operations. This layer has
 * NO dependency on React, the model, or storage. It is deterministic and
 * unit-testable, and it is the sole authority on task IDENTITY STABILITY: a task's
 * `id` is assigned once at creation and is never changed by any operation here or by
 * any customization. Every operation returns NEW immutable values (no mutation),
 * which makes identity stability easy to assert in tests.
 */

/** A single planner task. Identity is `id`, stable for the task's whole lifetime. */
export interface Task {
  /** Stable, unique identity. Never changes after creation. */
  readonly id: string;
  readonly title: string;
  readonly notes: string;
  readonly completed: boolean;
  /** Position in the ordered list; lower sorts first. */
  readonly order: number;
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
  newId: () => `t_${globalThis.crypto.randomUUID()}`,
};

/** Fields a caller may supply when creating a task. */
export interface CreateTaskInput {
  readonly title: string;
  readonly notes?: string;
}

/** Fields a caller may edit. Identity (`id`) and `order` are NOT editable here. */
export interface EditTaskInput {
  readonly title?: string;
  readonly notes?: string;
}

/**
 * Create a task, appended to the end of the current list. The new task's `order` is
 * one past the current maximum, so creation never reorders existing tasks.
 */
export function createTask(
  tasks: readonly Task[],
  input: CreateTaskInput,
  clock: DomainClock = systemClock,
): readonly Task[] {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error('Task title must not be empty.');
  }
  const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order), -1);
  const ts = clock.now();
  const task: Task = {
    id: clock.newId(),
    title,
    notes: input.notes?.trim() ?? '',
    completed: false,
    order: maxOrder + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  return [...tasks, task];
}

/** Edit a task's content. Identity, order, and completion are untouched. */
export function editTask(
  tasks: readonly Task[],
  id: string,
  input: EditTaskInput,
  clock: DomainClock = systemClock,
): readonly Task[] {
  return mapTask(tasks, id, (t) => {
    const nextTitle = input.title !== undefined ? input.title.trim() : t.title;
    if (nextTitle.length === 0) {
      throw new Error('Task title must not be empty.');
    }
    return {
      ...t,
      title: nextTitle,
      notes: input.notes !== undefined ? input.notes.trim() : t.notes,
      updatedAt: clock.now(),
    };
  });
}

/** Toggle (or set) completion. Never changes identity, title, notes, or order. */
export function completeTask(
  tasks: readonly Task[],
  id: string,
  completed: boolean,
  clock: DomainClock = systemClock,
): readonly Task[] {
  return mapTask(tasks, id, (t) =>
    t.completed === completed ? t : { ...t, completed, updatedAt: clock.now() },
  );
}

/**
 * Reorder: move the task with `id` to `toIndex` in the current sorted order, then
 * renumber `order` densely (0..n-1). Identities and contents are preserved; only the
 * `order` field changes. A no-op (same position) returns an equivalently ordered list.
 */
export function reorderTask(
  tasks: readonly Task[],
  id: string,
  toIndex: number,
  clock: DomainClock = systemClock,
): readonly Task[] {
  const sorted = sortTasks(tasks);
  const from = sorted.findIndex((t) => t.id === id);
  if (from === -1) {
    throw new Error(`Cannot reorder unknown task "${id}".`);
  }
  const clamped = Math.max(0, Math.min(toIndex, sorted.length - 1));
  const moved = sorted.filter((t) => t.id !== id);
  const target = sorted[from]!;
  moved.splice(clamped, 0, target);
  const ts = clock.now();
  return moved.map((t, i) =>
    t.order === i ? t : { ...t, order: i, updatedAt: t.id === id ? ts : t.updatedAt },
  );
}

/** Return tasks sorted by `order` (ascending), stable on ties by `createdAt`. */
export function sortTasks(tasks: readonly Task[]): readonly Task[] {
  return [...tasks].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.createdAt.localeCompare(b.createdAt),
  );
}

/** Apply `fn` to the task whose id matches; throws if the id is unknown. */
function mapTask(
  tasks: readonly Task[],
  id: string,
  fn: (t: Task) => Task,
): readonly Task[] {
  let found = false;
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    found = true;
    return fn(t);
  });
  if (!found) {
    throw new Error(`Unknown task "${id}".`);
  }
  return next;
}

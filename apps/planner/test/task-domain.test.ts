/**
 * Planner domain unit tests (spec task 9; R1): pure task ops + identity stability.
 */

import { describe, it, expect } from 'vitest';
import {
  completeTask,
  createTask,
  editTask,
  reorderTask,
  sortTasks,
  type DomainClock,
  type Task,
} from '../src/domain/task.js';

function stubClock(): DomainClock {
  let n = 0;
  return {
    now: () => `2026-11-03T00:00:${String(n).padStart(2, '0')}.000Z`,
    newId: () => `t_${++n}`,
  };
}

function build(titles: readonly string[], clock: DomainClock): readonly Task[] {
  let tasks: readonly Task[] = [];
  for (const title of titles) tasks = createTask(tasks, { title }, clock);
  return tasks;
}

describe('task domain', () => {
  it('creates tasks appended in order with stable unique ids', () => {
    const clock = stubClock();
    const tasks = build(['a', 'b', 'c'], clock);
    expect(tasks.map((t) => t.title)).toEqual(['a', 'b', 'c']);
    expect(tasks.map((t) => t.order)).toEqual([0, 1, 2]);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(3);
    expect(tasks.every((t) => !t.completed)).toBe(true);
  });

  it('rejects an empty title on create and edit', () => {
    const clock = stubClock();
    expect(() => createTask([], { title: '   ' }, clock)).toThrow();
    const tasks = build(['a'], clock);
    expect(() => editTask(tasks, tasks[0]!.id, { title: '' }, clock)).toThrow();
  });

  it('edits content without changing identity, order, or completion', () => {
    const clock = stubClock();
    const tasks = build(['a', 'b'], clock);
    const id = tasks[0]!.id;
    const edited = editTask(tasks, id, { title: 'A!', notes: 'note' }, clock);
    const t = edited.find((x) => x.id === id)!;
    expect(t.id).toBe(id);
    expect(t.title).toBe('A!');
    expect(t.notes).toBe('note');
    expect(t.order).toBe(tasks[0]!.order);
    expect(t.completed).toBe(false);
  });

  it('completes and un-completes without touching other fields', () => {
    const clock = stubClock();
    const tasks = build(['a'], clock);
    const id = tasks[0]!.id;
    const done = completeTask(tasks, id, true, clock);
    expect(done[0]!.completed).toBe(true);
    expect(done[0]!.id).toBe(id);
    expect(done[0]!.title).toBe('a');
    const undone = completeTask(done, id, false, clock);
    expect(undone[0]!.completed).toBe(false);
  });

  it('reorders by moving to an index and renumbers densely, ids preserved', () => {
    const clock = stubClock();
    const tasks = build(['a', 'b', 'c'], clock);
    const idsBefore = new Set(tasks.map((t) => t.id));
    const cId = tasks[2]!.id;
    const moved = sortTasks(reorderTask(tasks, cId, 0, clock));
    expect(moved.map((t) => t.title)).toEqual(['c', 'a', 'b']);
    expect(moved.map((t) => t.order)).toEqual([0, 1, 2]);
    expect(new Set(moved.map((t) => t.id))).toEqual(idsBefore);
  });

  it('keeps every task identity stable across a full op sequence', () => {
    const clock = stubClock();
    let tasks = build(['a', 'b', 'c'], clock);
    const ids = sortTasks(tasks).map((t) => t.id);
    tasks = completeTask(tasks, tasks[0]!.id, true, clock);
    tasks = editTask(tasks, tasks[1]!.id, { title: 'B2' }, clock);
    tasks = reorderTask(tasks, tasks[2]!.id, 0, clock);
    const idsAfter = sortTasks(tasks).map((t) => t.id).sort();
    expect([...ids].sort()).toEqual(idsAfter);
  });

  it('throws on operations against an unknown id', () => {
    const clock = stubClock();
    const tasks = build(['a'], clock);
    expect(() => editTask(tasks, 'nope', { title: 'x' }, clock)).toThrow();
    expect(() => completeTask(tasks, 'nope', true, clock)).toThrow();
    expect(() => reorderTask(tasks, 'nope', 0, clock)).toThrow();
  });
});

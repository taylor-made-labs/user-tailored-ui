/**
 * React state hook binding the pure domain + the customization service to the UI
 * (spec task 6). It owns no business rules — those live in the domain and the
 * validator. It wires:
 *   - task CRUD/reorder/complete, persisted to the IndexedDB task store,
 *   - the agent panel flow: utterance -> preview -> apply / reject / undo,
 *   - reopen of saved customization under current policy on first load.
 *
 * Stores are injectable so a test (or the demo) can pass in-memory doubles; the app
 * entry wires the IndexedDB + in-memory-history defaults.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  completeTask,
  createTask,
  editTask,
  reorderTask,
  sortTasks,
  systemClock,
  type Task,
} from '../domain/task.js';
import type { TaskStore } from '../ports/task-store.js';
import {
  PlannerCustomization,
  type PlannerCustomizationDeps,
} from '../customization/service.js';
import type {
  HistoryRef,
  RejectionReason,
  ViewDescriptor,
} from '../ports/foundation.js';

export interface PlannerPreview {
  readonly view: ViewDescriptor;
  readonly simulated: boolean;
  readonly providerId: string;
  readonly rationale?: string;
}

export interface UsePlannerArgs {
  readonly userId: string;
  readonly taskStore: TaskStore;
  readonly customizationDeps: Omit<PlannerCustomizationDeps, 'userId'>;
}

export interface PlannerState {
  readonly tasks: readonly Task[];
  readonly view: ViewDescriptor;
  readonly preview: PlannerPreview | null;
  readonly rejection: readonly RejectionReason[] | null;
  /** Honest provider failure (auth, quota, network, bad reply). The last valid view is kept. */
  readonly error: string | null;
  readonly history: readonly HistoryRef[];
  readonly addTask: (title: string) => void;
  readonly editTaskTitle: (id: string, title: string) => void;
  readonly toggleComplete: (id: string) => void;
  readonly moveTask: (id: string, toIndex: number) => void;
  readonly propose: (utterance: string) => Promise<void>;
  readonly applyPreview: () => Promise<void>;
  readonly dismissPreview: () => void;
  readonly undo: (ref: string) => Promise<void>;
}

export function usePlanner(args: UsePlannerArgs): PlannerState {
  const { userId, taskStore } = args;
  const cz = useMemo(
    () => new PlannerCustomization({ userId, ...args.customizationDeps }),
    // Service identity is stable per user for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [view, setView] = useState<ViewDescriptor>(cz.defaults);
  const [preview, setPreview] = useState<PlannerPreview | null>(null);
  const [rejection, setRejection] = useState<readonly RejectionReason[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly HistoryRef[]>([]);

  const refreshHistory = useCallback(async () => {
    setHistory(await cz.listHistory());
  }, [cz]);

  // Load persisted tasks + revalidate any saved customization under current policy.
  useEffect(() => {
    let live = true;
    void (async () => {
      const loaded = sortTasks(await taskStore.load(userId));
      if (!live) return;
      setTasks(loaded);
      const reopened = await cz.reopen();
      if (!live) return;
      setView(reopened.view);
      await refreshHistory();
    })();
    return () => {
      live = false;
    };
  }, [cz, taskStore, userId, refreshHistory]);

  const persist = useCallback(
    (next: readonly Task[]) => {
      setTasks(next);
      void taskStore.save(userId, next);
    },
    [taskStore, userId],
  );

  const addTask = useCallback(
    (title: string) => {
      if (title.trim().length === 0) return;
      persist(createTask(tasks, { title }, systemClock));
    },
    [tasks, persist],
  );

  const editTaskTitle = useCallback(
    (id: string, title: string) => {
      persist(editTask(tasks, id, { title }, systemClock));
    },
    [tasks, persist],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      persist(completeTask(tasks, id, !t.completed, systemClock));
    },
    [tasks, persist],
  );

  const moveTask = useCallback(
    (id: string, toIndex: number) => {
      persist(reorderTask(tasks, id, toIndex, systemClock));
    },
    [tasks, persist],
  );

  const propose = useCallback(
    async (utterance: string) => {
      setRejection(null);
      setPreview(null);
      setError(null);
      let outcome;
      try {
        outcome = await cz.proposeFromUtterance(view, utterance);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The agent failed.');
        return;
      }
      if (outcome.ok) {
        setPreview({
          view: outcome.preview.view,
          simulated: outcome.preview.simulated,
          providerId: outcome.preview.providerId,
          ...(outcome.preview.rationale !== undefined
            ? { rationale: outcome.preview.rationale }
            : {}),
        });
      } else {
        setRejection(outcome.result.reasons);
      }
    },
    [cz, view],
  );

  const applyPreview = useCallback(async () => {
    if (!preview) return;
    const res = await cz.apply(view, preview.view, preview.rationale ?? 'customize');
    if (res.ok) {
      setView(res.view);
      setPreview(null);
      setRejection(null);
      await refreshHistory();
    } else {
      setRejection(res.result.reasons);
      setPreview(null);
    }
  }, [cz, view, preview, refreshHistory]);

  const dismissPreview = useCallback(() => {
    setPreview(null);
    setRejection(null);
    setError(null);
  }, []);

  const undo = useCallback(
    async (ref: string) => {
      const res = await cz.undoTo(ref);
      if (res) {
        setView(res.view);
        setPreview(null);
        setRejection(null);
      }
    },
    [cz],
  );

  return {
    tasks,
    view,
    preview,
    rejection,
    error,
    history,
    addTask,
    editTaskTitle,
    toggleComplete,
    moveTask,
    propose,
    applyPreview,
    dismissPreview,
    undo,
  };
}

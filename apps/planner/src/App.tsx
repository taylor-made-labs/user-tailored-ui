/**
 * Planner app shell (spec task 6).
 *
 * Composes the task board/agenda (rendered through the UiCapability port) with the
 * in-app agent panel. Business task state and customization state are two separate
 * concerns wired together here by the `usePlanner` hook; neither can corrupt the
 * other. Stores are injected by `main.tsx` (IndexedDB for tasks, in-memory history
 * by default), and are also injectable for tests/demo.
 */

import type { TaskStore } from './ports/task-store.js';
import { usePlanner } from './ui/usePlanner.js';
import { AddTask, TaskList } from './ui/components.js';
import { AgentPanel } from './ui/AgentPanel.js';

export interface AppProps {
  readonly userId: string;
  readonly taskStore: TaskStore;
}

export function App(props: AppProps): JSX.Element {
  const planner = usePlanner({ userId: props.userId, taskStore: props.taskStore });
  const isAgenda = planner.view.components.some((c) => c.componentId === 'agenda');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ marginBottom: 2 }}>User-Tailored Planner</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>
          View: <strong>{isAgenda ? 'focused daily agenda' : 'board'}</strong>
        </p>
      </header>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <section style={{ flex: 1 }}>
          <AddTask onAdd={planner.addTask} />
          <TaskList
            view={planner.view}
            tasks={planner.tasks}
            onToggleComplete={planner.toggleComplete}
            onEditTitle={planner.editTaskTitle}
            onMove={planner.moveTask}
          />
        </section>
        <AgentPanel planner={planner} />
      </div>
    </main>
  );
}

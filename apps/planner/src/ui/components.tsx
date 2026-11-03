/**
 * Presentational React components (spec task 6). They render DATA resolved through
 * the UiCapability port — no business logic, no validation here. The board/agenda
 * layout and task-card density/fontScale come from the resolved render descriptors,
 * proving the customization actually drives presentation.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { RenderDescriptor, ViewDescriptor } from '../ports/foundation.js';
import { TailoredUiCapabilityAdapter } from '../adapters/ui-capability.js';
import { PlannerComponents, PlannerControls } from '../customization/policy.js';
import type { Task } from '../domain/task.js';
import { sortTasks } from '../domain/task.js';

const capability = new TailoredUiCapabilityAdapter();

function propNumber(desc: RenderDescriptor | null, key: string, fallback: number): number {
  const v = desc?.resolvedProps[key];
  return typeof v === 'number' ? v : fallback;
}

function propString(desc: RenderDescriptor | null, key: string, fallback: string): string {
  const v = desc?.resolvedProps[key];
  return typeof v === 'string' ? v : fallback;
}

export interface TaskListProps {
  readonly view: ViewDescriptor;
  readonly tasks: readonly Task[];
  readonly onToggleComplete: (id: string) => void;
  readonly onEditTitle: (id: string, title: string) => void;
  readonly onMove: (id: string, toIndex: number) => void;
}

/**
 * Renders the current task collection using whichever container component the view
 * selected (board or agenda) and the task-card tokens. The complete control is
 * rendered per task; it is a policy-required control, so the view can never remove it.
 */
export function TaskList(props: TaskListProps): JSX.Element {
  const { view, tasks } = props;
  const container =
    view.components.find((c) => c.componentId === PlannerComponents.Agenda) ??
    view.components.find((c) => c.componentId === PlannerComponents.Board) ??
    { componentId: PlannerComponents.Board };
  const containerDesc = capability.resolve(container, view.tokens);
  const cardDesc = capability.resolve(
    { componentId: PlannerComponents.TaskCard },
    view.tokens,
  );

  const layout = propString(containerDesc, 'layout', 'board');
  const density = propString(cardDesc, 'density', 'comfortable');
  const fontScale = propNumber(cardDesc, 'fontScale', 1);
  const hasCompleteControl = view.controls.some(
    (c) => c.controlId === PlannerControls.CompleteTask,
  );

  const gap = density === 'compact' ? 4 : 12;
  const ordered = sortTasks(tasks);

  const containerStyle: CSSProperties = {
    display: layout === 'agenda' ? 'flex' : 'grid',
    flexDirection: 'column',
    gap,
    fontSize: `${fontScale}rem`,
  };
  if (layout === 'board') {
    containerStyle.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
  }

  return (
    <div data-layout={layout} style={containerStyle}>
      {ordered.length === 0 && <p style={{ opacity: 0.6 }}>No tasks yet. Add one above.</p>}
      {ordered.map((t, index) => (
        <TaskCard
          key={t.id}
          task={t}
          index={index}
          total={ordered.length}
          density={density}
          showComplete={hasCompleteControl}
          onToggleComplete={props.onToggleComplete}
          onEditTitle={props.onEditTitle}
          onMove={props.onMove}
        />
      ))}
    </div>
  );
}

interface TaskCardProps {
  readonly task: Task;
  readonly index: number;
  readonly total: number;
  readonly density: string;
  readonly showComplete: boolean;
  readonly onToggleComplete: (id: string) => void;
  readonly onEditTitle: (id: string, title: string) => void;
  readonly onMove: (id: string, toIndex: number) => void;
}

function TaskCard(props: TaskCardProps): JSX.Element {
  const { task, index, total, density, showComplete } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const pad = density === 'compact' ? '4px 8px' : '10px 12px';

  return (
    <div
      data-task-id={task.id}
      style={{
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: pad,
        background: task.completed ? '#f2f7f2' : '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {showComplete && (
        <input
          type="checkbox"
          aria-label={`Complete ${task.title}`}
          data-control={PlannerControls.CompleteTask}
          checked={task.completed}
          onChange={() => props.onToggleComplete(task.id)}
        />
      )}
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft !== task.title) props.onEditTitle(task.id, draft);
            else setDraft(task.title);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          style={{ flex: 1 }}
        />
      ) : (
        <span
          style={{
            flex: 1,
            textDecoration: task.completed ? 'line-through' : 'none',
            cursor: 'text',
          }}
          onDoubleClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
        >
          {task.title}
        </span>
      )}
      <button
        aria-label={`Move ${task.title} up`}
        disabled={index === 0}
        onClick={() => props.onMove(task.id, index - 1)}
      >
        ↑
      </button>
      <button
        aria-label={`Move ${task.title} down`}
        disabled={index === total - 1}
        onClick={() => props.onMove(task.id, index + 1)}
      >
        ↓
      </button>
    </div>
  );
}

export interface AddTaskProps {
  readonly onAdd: (title: string) => void;
}

export function AddTask(props: AddTaskProps): JSX.Element {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onAdd(title);
        setTitle('');
      }}
      style={{ display: 'flex', gap: 8, marginBottom: 12 }}
    >
      <input
        aria-label="New task title"
        data-control={PlannerControls.AddTask}
        value={title}
        placeholder="Add a task…"
        onChange={(e) => setTitle(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="submit">Add</button>
    </form>
  );
}

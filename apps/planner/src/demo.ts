/**
 * Runnable, headless demo of the Planner slice (spec task 9).
 *
 * Exercises the whole enforced flow with the labeled offline test-double agent and
 * the in-memory stores — no browser, no network, no secrets. Run with:
 *
 *     npx tsx src/demo.ts
 *
 * It prints: the task workflow, a VALID agenda customization (applied + saved), all
 * FOUR policy violations being rejected with cited reasons, and save/reopen/undo
 * preserving both the tasks and the required complete control.
 */

import {
  completeTask,
  createTask,
  reorderTask,
  sortTasks,
  type DomainClock,
  type Task,
} from './domain/task.js';
import { InMemoryTaskStore } from './adapters/task-store-memory.js';
import { PlannerCustomization } from './customization/service.js';
import { violationProposals, type ViolationId } from './customization/views.js';
import { PlannerControls } from './customization/policy.js';

function fixedClock(): DomainClock {
  let n = 0;
  return {
    now: () => `2026-11-03T00:00:${String(n++).padStart(2, '0')}.000Z`,
    newId: () => `t_${n++}`,
  };
}

function line(s: string): void {
  // eslint-disable-next-line no-console
  console.log(s);
}

async function main(): Promise<void> {
  const clock = fixedClock();
  const userId = 'demo-user';

  // --- Business task workflow (persists, offline) --------------------------
  line('== Task workflow ==');
  const store = new InMemoryTaskStore();
  let tasks: readonly Task[] = [];
  tasks = createTask(tasks, { title: 'Write the demo' }, clock);
  tasks = createTask(tasks, { title: 'Review the PR' }, clock);
  tasks = createTask(tasks, { title: 'Ship it' }, clock);
  tasks = completeTask(tasks, tasks[0]!.id, true, clock);
  tasks = reorderTask(tasks, tasks[2]!.id, 0, clock);
  await store.save(userId, tasks);
  const reloaded = sortTasks(await store.load(userId));
  for (const t of reloaded) {
    line(`  [${t.completed ? 'x' : ' '}] ${t.title}  (id=${t.id})`);
  }
  const taskIdsBefore = reloaded.map((t) => t.id).join(',');

  // --- Customization: valid agenda transform -------------------------------
  line('\n== Customize: board -> focused daily agenda ==');
  const cz = new PlannerCustomization({ userId, now: clock.now });
  let current = cz.defaults;
  const proposed = await cz.proposeFromUtterance(current, 'make it a focused daily agenda');
  if (!proposed.ok) throw new Error('agenda proposal unexpectedly rejected');
  line(`  preview simulated=${proposed.preview.simulated} provider=${proposed.preview.providerId}`);
  line(`  components -> ${proposed.preview.view.components.map((c) => c.componentId).join(', ')}`);
  const applied = await cz.apply(current, proposed.preview.view, 'agenda');
  if (!applied.ok) throw new Error('agenda apply unexpectedly rejected');
  current = applied.view;
  line('  applied + saved. complete control present: ' +
    current.controls.some((c) => c.controlId === PlannerControls.CompleteTask));

  // --- The four violation classes, all rejected with cited reasons ---------
  line('\n== Four policy violations (all rejected) ==');
  const ids: readonly ViolationId[] = [
    'remove-complete-control',
    'font-scale-over-limit',
    'non-approved-component',
    'disallowed-action',
  ];
  for (const id of ids) {
    const outcome = cz.previewProposal(current, violationProposals[id], {
      simulated: true,
      providerId: 'test-double',
    });
    if (outcome.ok) throw new Error(`violation "${id}" was NOT rejected`);
    const reason = outcome.result.reasons[0]!;
    line(`  ${id}: REJECTED -> ${reason.invariant} (${reason.subject})`);
  }
  // The last valid view is kept after rejections.
  line('  last valid view still agenda: ' +
    current.components.some((c) => c.componentId === 'agenda'));

  // --- Save / reopen / undo ------------------------------------------------
  line('\n== Save / reopen / undo ==');
  const refs = await cz.listHistory();
  const reopened = await cz.reopen();
  line(`  reopen -> fallback=${reopened.usedFallback} stale=${reopened.staleAgainstPolicy} ` +
    `components=[${reopened.view.components.map((c) => c.componentId).join(', ')}]`);
  const undo = await cz.undoTo(refs[refs.length - 1]!.id);
  line(`  undo to first save -> components=[${undo?.view.components.map((c) => c.componentId).join(', ')}]`);

  // Tasks are untouched by any customization or undo.
  const taskIdsAfter = sortTasks(await store.load(userId)).map((t) => t.id).join(',');
  line(`\n  task identities preserved through customization: ${taskIdsBefore === taskIdsAfter}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

/**
 * Runnable, headless demo of the Inventory slice.
 *
 * Exercises the whole enforced flow with the labeled offline test-double agent and
 * the in-memory stores — no browser, no network, no secrets. Run with:
 *
 *     npx tsx src/demo.ts
 *
 * It prints: the item workflow (create / edit / adjustQty clamped at 0 / delete), a
 * VALID low-stock focus customization (applied + saved, hiding healthy items while
 * keeping every id), all FOUR policy violations being rejected with cited reasons,
 * and save/reopen/undo preserving both the items and the required adjust-qty control.
 */

import {
  adjustQty,
  createItem,
  deleteItem,
  editItem,
  isLowStock,
  sortItems,
  type DomainClock,
  type Item,
} from './domain/item.js';
import { InMemoryItemStore } from './adapters/item-store-memory.js';
import { InventoryCustomization } from './customization/service.js';
import { violationProposals, type ViolationId } from './customization/views.js';
import { InventoryControls } from './customization/policy.js';

function fixedClock(): DomainClock {
  let n = 0;
  return {
    now: () => `2026-11-03T00:00:${String(n++).padStart(2, '0')}.000Z`,
    newId: () => `i_${n++}`,
  };
}

function line(s: string): void {
  // eslint-disable-next-line no-console
  console.log(s);
}

async function main(): Promise<void> {
  const clock = fixedClock();
  const userId = 'demo-user';

  // --- Business item workflow (persists, offline) --------------------------
  line('== Item workflow ==');
  const store = new InMemoryItemStore();
  let items: readonly Item[] = [];
  items = createItem(items, { name: 'AA Batteries', quantity: 12, location: 'A1', lowStockThreshold: 4 }, clock);
  items = createItem(items, { name: 'Printer Paper', quantity: 2, location: 'B3', lowStockThreshold: 5 }, clock);
  items = createItem(items, { name: 'USB-C Cables', quantity: 0, location: 'C2', lowStockThreshold: 3 }, clock);
  // Edit a descriptive field (identity + quantity untouched).
  items = editItem(items, items[0]!.id, { location: 'A1-top' }, clock);
  // Adjust quantity by a signed delta; clamp proves stock never goes negative.
  items = adjustQty(items, items[1]!.id, -1, clock); // 2 -> 1
  items = adjustQty(items, items[2]!.id, -5, clock); // 0 -> 0 (clamped)
  await store.save(userId, items);
  const reloaded = sortItems(await store.load(userId));
  for (const it of reloaded) {
    line(`  ${it.name}: qty ${it.quantity} @ ${it.location} (threshold ${it.lowStockThreshold})` +
      `${isLowStock(it) ? '  <- LOW' : ''}  (id=${it.id})`);
  }
  // Delete one item, prove the rest keep their ids.
  const idsBeforeDelete = reloaded.map((it) => it.id);
  items = deleteItem(items, items[0]!.id);
  line(`  deleted "AA Batteries"; remaining ids still stable: ` +
    `${items.every((it) => idsBeforeDelete.includes(it.id))}`);
  const taskIdsBefore = sortItems(items).map((it) => it.id).join(',');
  await store.save(userId, items);

  // --- Customization: valid low-stock focus transform ----------------------
  line('\n== Customize: full catalog -> low-stock focus ==');
  const cz = new InventoryCustomization({ userId, now: clock.now });
  let current = cz.defaults;
  const proposed = await cz.proposeFromUtterance(current, 'show only low stock items to restock');
  if (!proposed.ok) throw new Error('low-stock proposal unexpectedly rejected');
  line(`  preview simulated=${proposed.preview.simulated} provider=${proposed.preview.providerId}`);
  line(`  components -> ${proposed.preview.view.components.map((c) => c.componentId).join(', ')}`);
  line(`  lowStockOnly -> ${String(proposed.preview.view.tokens.lowStockOnly)}`);
  const applied = await cz.apply(current, proposed.preview.view, 'low-stock focus');
  if (!applied.ok) throw new Error('low-stock apply unexpectedly rejected');
  current = applied.view;
  line('  applied + saved. adjust-qty control present: ' +
    current.controls.some((c) => c.controlId === InventoryControls.AdjustQty));

  // --- The four violation classes, all rejected with cited reasons ---------
  line('\n== Four policy violations (all rejected) ==');
  const ids: readonly ViolationId[] = [
    'remove-adjust-control',
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
  line('  last valid view still low-stock focus: ' +
    current.components.some((c) => c.componentId === 'low-stock-view'));

  // --- Save / reopen / undo ------------------------------------------------
  line('\n== Save / reopen / undo ==');
  const refs = await cz.listHistory();
  const reopened = await cz.reopen();
  line(`  reopen -> fallback=${reopened.usedFallback} stale=${reopened.staleAgainstPolicy} ` +
    `components=[${reopened.view.components.map((c) => c.componentId).join(', ')}]`);
  const undo = await cz.undoTo(refs[refs.length - 1]!.id);
  line(`  undo to first save -> components=[${undo?.view.components.map((c) => c.componentId).join(', ')}]`);

  // Items are untouched by any customization or undo.
  const taskIdsAfter = sortItems(await store.load(userId)).map((it) => it.id).join(',');
  line(`\n  item identities preserved through customization: ${taskIdsBefore === taskIdsAfter}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

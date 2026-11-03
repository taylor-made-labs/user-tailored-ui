/**
 * Default view (grid) and the view/proposal data the Inventory app drives through
 * the foundation orchestrator.
 *
 * The defaults view is the trusted shipped baseline; it MUST itself satisfy the
 * policy. The low-stock-focus transform and the four violation fixtures are
 * expressed purely as validated proposals — data, never code (steering: model output
 * is data).
 *
 * The CUSTOMIZATION STORY (distinct from the Planner's "daily agenda"): a "low-stock
 * focus view" that HIDES healthy items (quantity above threshold) while KEEPING every
 * item id present in business data, the adjust-qty control operable, and all actions
 * available. The hiding is a presentational `lowStockOnly` token + the
 * `low-stock-view` container; it never deletes or reorders stored items.
 */

import type { CustomizationProposal, ViewDescriptor } from '../ports/foundation.js';
import {
  InventoryActions,
  InventoryComponents,
  InventoryControls,
} from './policy.js';

/**
 * The shipped DEFAULT view: a grid that exposes all four item actions, the adjust-qty
 * control (required) plus the add-item control, and a comfortable/1x presentation
 * showing every item. Item cards are rendered by the `item-card` component; the grid
 * is the container.
 */
export const defaultGridView: ViewDescriptor = {
  tokens: {
    fontScale: 1,
    density: 'comfortable',
    lowStockOnly: false,
  },
  components: [
    { componentId: InventoryComponents.Grid },
    { componentId: InventoryComponents.ItemCard },
  ],
  controls: [
    { controlId: InventoryControls.AdjustQty },
    { controlId: InventoryControls.AddItem },
  ],
  actions: [
    InventoryActions.Create,
    InventoryActions.Edit,
    InventoryActions.AdjustQty,
    InventoryActions.Delete,
  ],
};

/**
 * The "low-stock focus view" transform: swap grid -> low-stock-view, turn on the
 * `lowStockOnly` filter, set density compact, and KEEP the item-card component, the
 * adjust-qty control, and every action. This is the meaningful, policy-VALID
 * customization. Healthy items are hidden on screen only — their ids remain in the
 * business store untouched.
 */
export const lowStockFocusProposal: CustomizationProposal = {
  tokens: { lowStockOnly: true, density: 'compact' },
  components: [
    { componentId: InventoryComponents.LowStockView },
    { componentId: InventoryComponents.ItemCard },
  ],
  controls: [
    { controlId: InventoryControls.AdjustQty },
    { controlId: InventoryControls.AddItem },
  ],
  actions: [
    InventoryActions.Create,
    InventoryActions.Edit,
    InventoryActions.AdjustQty,
    InventoryActions.Delete,
  ],
  rationale: 'Low-stock focus: show only items at or below threshold, compact density.',
};

/** Identifier for each of the four required violation fixtures. */
export type ViolationId =
  | 'remove-adjust-control'
  | 'font-scale-over-limit'
  | 'non-approved-component'
  | 'disallowed-action';

/**
 * The FOUR violation fixtures — one proposal per invariant class the policy enforces.
 * Each is designed to be REJECTED by the deterministic validator with a cited
 * InvariantKind; the last valid view is kept. They are exercised by tests and
 * selectable in the demo UI.
 */
export const violationProposals: Readonly<Record<ViolationId, CustomizationProposal>> = {
  // (a) MissingRequiredControl — drops the adjust-qty control from the view.
  'remove-adjust-control': {
    controls: [{ controlId: InventoryControls.AddItem }],
    rationale: 'Hide the quantity adjuster to declutter.',
  },
  // (b) TokenOutOfRange — fontScale 2.5 exceeds the max of 2.
  'font-scale-over-limit': {
    tokens: { fontScale: 2.5 },
    rationale: 'Make everything huge.',
  },
  // (c) DisallowedComponent — introduces a component not on the allow-list.
  'non-approved-component': {
    components: [
      { componentId: InventoryComponents.Grid },
      { componentId: 'kanban' },
    ],
    rationale: 'Add a kanban board.',
  },
  // (d) DisallowedAction — enables an action the policy does not permit.
  'disallowed-action': {
    actions: [...defaultGridView.actions, 'item.archive'],
    rationale: 'Add an archive action.',
  },
};

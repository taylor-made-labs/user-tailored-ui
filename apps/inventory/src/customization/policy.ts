/**
 * The Inventory's CreatorPolicy.
 *
 * This is the creator-owned, trusted, versioned definition of what any customized
 * view MUST satisfy. It is consumed by the foundation's deterministic validator; the
 * agent and the user can only select among the options it allows — they can never
 * relax it (Policy > Defaults > Preferences).
 *
 * DISTINCT from the Planner's policy (different actions, required control, and
 * components), which is the point of the second-app flywheel proof:
 *   - allowedActions: item.create / item.edit / item.adjustQty / item.delete
 *   - requiredControls: the quantity-adjust control ("adjust-qty") MUST stay present
 *     and operable in every view — you can hide healthy items, never the ability to
 *     restock.
 *   - allowedComponents: grid / list / low-stock-view / item-card (allow-list)
 *   - tokenRules: fontScale is a number in [1, 2] (accessibility floor: never < 1);
 *                 density is an enum of { compact, comfortable };
 *                 lowStockOnly is a boolean (drives the low-stock focus view — hides
 *                 healthy items visually while every item id stays in business data).
 */

import { JsonPolicySource } from '../ports/foundation.js';
import policyJson from '../../creator-policy.json';

/** Stable action ids the Inventory domain exposes. */
export const InventoryActions = {
  Create: 'item.create',
  Edit: 'item.edit',
  AdjustQty: 'item.adjustQty',
  Delete: 'item.delete',
} as const;

/** Stable component ids on the Inventory allow-list. */
export const InventoryComponents = {
  Grid: 'grid',
  List: 'list',
  LowStockView: 'low-stock-view',
  ItemCard: 'item-card',
} as const;

/** Stable control ids. The quantity-adjust control is a required invariant. */
export const InventoryControls = {
  /** The quantity-adjust control — MUST remain present and operable in every view. */
  AdjustQty: 'adjust-qty',
  AddItem: 'add-item',
} as const;

/**
 * The inventory policy, loaded from `creator-policy.json` (the creator edits that file).
 * Fails closed: an invalid file throws `PolicyLoadError` at startup. `fontScale` min 1
 * is the ACCESSIBILITY FLOOR: text may be enlarged up to 2x but never shrunk.
 */
export const inventoryPolicy = new JsonPolicySource(policyJson).load();

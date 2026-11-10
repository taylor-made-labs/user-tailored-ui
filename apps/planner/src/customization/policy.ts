/**
 * The Planner's CreatorPolicy (spec task 2, R2).
 *
 * This is the creator-owned, trusted, versioned definition of what any customized
 * view MUST satisfy. It is consumed by the foundation's deterministic validator; the
 * agent and the user can only select among the options it allows — they can never
 * relax it (Policy > Defaults > Preferences).
 *
 * Concrete invariants (from R2):
 *   - allowedActions: task.create / task.edit / task.reorder / task.complete
 *   - requiredControls: the complete-task control must stay present and operable
 *   - allowedComponents: board / agenda / task-card (allow-list)
 *   - tokenRules: fontScale is a number in [1, 2] (accessibility floor: never < 1);
 *                 density is an enum of { compact, comfortable }
 */

import { JsonPolicySource } from '../ports/foundation.js';
import policyJson from '../../creator-policy.json';

/** Stable action ids the Planner domain exposes. */
export const PlannerActions = {
  Create: 'task.create',
  Edit: 'task.edit',
  Reorder: 'task.reorder',
  Complete: 'task.complete',
} as const;

/** Stable component ids on the Planner allow-list. */
export const PlannerComponents = {
  Board: 'board',
  Agenda: 'agenda',
  TaskCard: 'task-card',
} as const;

/** Stable control ids. The complete-task control is a required invariant. */
export const PlannerControls = {
  /** The complete-task control — MUST remain present and operable in every view. */
  CompleteTask: 'complete-task',
  AddTask: 'add-task',
} as const;

/**
 * The planner policy, loaded from `creator-policy.json` (the creator edits that file).
 * Fails closed: an invalid file throws `PolicyLoadError` at startup. `fontScale` min 1
 * is the ACCESSIBILITY FLOOR: text may be enlarged up to 2x but never shrunk.
 */
export const plannerPolicy = new JsonPolicySource(policyJson).load();

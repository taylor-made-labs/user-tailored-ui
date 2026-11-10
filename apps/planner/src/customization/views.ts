/**
 * Default view (board) and the view/proposal data the Planner drives through the
 * foundation orchestrator (spec tasks 4-partial, 7).
 *
 * The defaults view is the trusted shipped baseline; it MUST itself satisfy the
 * policy. The agenda transform and the four violation fixtures are expressed purely
 * as validated proposals — data, never code (steering: model output is data).
 */

import type { CustomizationProposal, ViewDescriptor } from '../ports/foundation.js';
import {
  PlannerActions,
  PlannerComponents,
  PlannerControls,
} from './policy.js';

/**
 * The shipped DEFAULT view: a board that exposes all four task actions, the
 * complete-task control (required), and a comfortable/1x presentation. Task cards
 * are rendered by the `task-card` component; the board is the container.
 */
export const defaultBoardView: ViewDescriptor = {
  tokens: {
    fontScale: 1,
    density: 'comfortable',
  },
  components: [
    { componentId: PlannerComponents.Board },
    { componentId: PlannerComponents.TaskCard },
  ],
  controls: [
    { controlId: PlannerControls.CompleteTask },
    { controlId: PlannerControls.AddTask },
  ],
  actions: [
    PlannerActions.Create,
    PlannerActions.Edit,
    PlannerActions.Reorder,
    PlannerActions.Complete,
  ],
};

/**
 * The "focused daily agenda" transform (R3): swap board -> agenda, set density
 * compact, KEEP the task-card component, the complete control, and every task id
 * (task ids live in business data, untouched by any view proposal). This is the
 * meaningful, policy-VALID customization.
 */
export const agendaProposal: CustomizationProposal = {
  tokens: { density: 'compact' },
  components: [
    { componentId: PlannerComponents.Agenda },
    { componentId: PlannerComponents.TaskCard },
  ],
  controls: [
    { controlId: PlannerControls.CompleteTask },
    { controlId: PlannerControls.AddTask },
  ],
  actions: [
    PlannerActions.Create,
    PlannerActions.Edit,
    PlannerActions.Reorder,
    PlannerActions.Complete,
  ],
  rationale: 'Focused daily agenda: single-column agenda, compact density.',
};

/** Identifier for each of the four required violation fixtures (R4). */
export type ViolationId =
  | 'remove-complete-control'
  | 'font-scale-over-limit'
  | 'non-approved-component'
  | 'disallowed-action';

/**
 * The FOUR violation fixtures (R4) — one proposal per invariant class the policy
 * enforces. Each is designed to be REJECTED by the deterministic validator with a
 * cited InvariantKind; the last valid view is kept. They are exercised by tests and
 * selectable in the demo UI.
 */
export const violationProposals: Readonly<Record<ViolationId, CustomizationProposal>> = {
  // (a) MissingRequiredControl — drops the complete-task control from the view.
  'remove-complete-control': {
    controls: [{ controlId: PlannerControls.AddTask }],
    rationale: 'Hide the complete button to declutter.',
  },
  // (b) TokenOutOfRange — fontScale 3 exceeds the max of 2.
  'font-scale-over-limit': {
    tokens: { fontScale: 3 },
    rationale: 'Make everything huge.',
  },
  // (c) DisallowedComponent — introduces a component not on the allow-list.
  'non-approved-component': {
    components: [
      { componentId: PlannerComponents.Board },
      { componentId: PlannerComponents.TaskCard },
      { componentId: 'banner-ad' },
    ],
    rationale: 'Add a promo banner.',
  },
  // (d) DisallowedAction — enables an action the policy does not permit.
  'disallowed-action': {
    actions: [...defaultBoardView.actions, 'task.delete-all'],
    rationale: 'Add a bulk delete-all action.',
  },
};

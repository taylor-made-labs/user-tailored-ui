# Requirements — Planner App (first dogfooding slice)

Status: **planned.** The Planner is the first app that adopts the foundation, proving the
tracer bullet in a real workflow before we expand to Inventory (the flywheel).

## Introduction

A task-planning app. Users create, edit, organize, and complete tasks (the persistent
business workflow), then use the in-app agent to **customize a board into a focused daily
agenda** — while preserving task identities, contents, actions, and creator constraints.

The Planner **adopts the foundation through its public exports and ports only** (dogfooding)
— no reaching into foundation internals, no copying the other app.

## Requirements

### R1 — Persistent task business workflow (first)
**User story:** As a user, I want to create/edit/organize/complete tasks that persist, so I
have a real workflow before any customization.
**Acceptance:**
- WHEN a user creates/edits/reorders/completes a task THEN the change SHALL persist across
  reload, stored separately from customization state.
- Task identity SHALL be stable across customization (a customized view never changes task
  ids or contents).

### R2 — Creator policy for the Planner
**User story:** As the Planner's creator, I want rules that keep the app usable no matter how
it's customized.
**Acceptance (concrete invariants):**
- Allowed actions: `task.create`, `task.edit`, `task.reorder`, `task.complete`.
- Required control: the complete-task control MUST remain present and operable.
- Approved components: `board`, `agenda`, `task-card` (allow-list).
- Visual limits: `fontScale` within [1, 2]; `density` ∈ {compact, comfortable}. (Accessibility
  floor: font scale may not drop below 1.)

### R3 — Customize board → focused daily agenda
**User story:** As a user, I want to ask (in natural language) to turn my board into a
focused daily agenda, and get a validated preview I can apply.
**Acceptance:**
- WHEN the user requests an agenda-style view THEN the agent SHALL produce a proposal that is
  validated; on pass, a preview is shown; on apply, state is saved.
- The agenda view SHALL preserve all task identities, contents, available actions, and the
  required complete control.

### R4 — Rejected violation with recoverable view (the required demo)
**User story:** As a judge, I want to see a customization that violates policy get rejected
with an explanation, and the app remain usable.
**Acceptance:**
- WHEN a request would remove the complete control, exceed the font-scale limit, introduce a
  non-approved component, or enable a disallowed action THEN the system SHALL reject it,
  explain which rule failed, and keep the last valid view.

### R5 — Save / reopen / undo under current policy
**Acceptance:**
- Customization SHALL save to user+app-scoped history; reopen SHALL revalidate under current
  policy; undo SHALL restore a prior valid customization without touching tasks.

### R6 — Offline-first; honest model labeling
**Acceptance:**
- Task workflow SHALL function offline (no server/model required).
- Customization SHALL work with the labeled test-double agent (offline) and, when configured,
  the real Anthropic agent; simulated results SHALL be labeled in the UI.

## Out of scope (this slice)
- Multi-user accounts/auth (user separation is demonstrated via scoped ids, not production accounts).
- The real Anthropic calls (wired in `inference-anthropic`; Planner uses the port).

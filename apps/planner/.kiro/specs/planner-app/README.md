# Planner app specs — placeholder

Status: **placeholder.** This directory will hold the Planner's spec-driven documents
(`requirements.md` → `design.md` → `tasks.md`), authored with the PM before the Planner
build begins.

The Planner's requirements are drafted in the foundation repo
([user-tailored-ui `.kiro/specs/planner-app/`](https://github.com/taylor-made-labs/user-tailored-ui/tree/main/.kiro/specs/planner-app))
while the foundation's contracts are being defined. As the Planner build moves into this
repo, the authoritative specs move here.

Planned scope (summary; see the foundation repo for the full draft):

- **R1** — persistent task workflow: create / edit / organize / complete, stored separately
  from customization state; stable task identity across customization.
- **R2** — creator policy: allowed actions, a required complete-task control, approved
  components, visual limits (with an accessibility floor).
- **R3** — customize a board into a focused daily agenda via the in-app agent, validated and
  previewed before apply.
- **R4** — a policy-violating request is rejected with an explanation; the last valid view is
  preserved (the required demo).
- **R5** — save / reopen / undo under current policy, scoped per user + app.
- **R6** — offline-first task workflow; honest labeling of the test-double vs. real agent.

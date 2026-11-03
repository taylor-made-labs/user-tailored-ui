# Tasks — Planner App

Status: **planned.** Executed after the foundation PR merges. Independent leaf tasks (marked
∥) can run as parallel waves.

- [ ] 1. Planner domain: `Task` entity + pure create/edit/reorder/complete ops with stable
      identities. _(R1)_ ∥
- [ ] 2. Planner `CreatorPolicy` (allowed actions, required complete control, approved
      components, font-scale/density limits incl. accessibility floor). _(R2)_ ∥
- [ ] 3. Business persistence store (IndexedDB), separate from customization history. _(R1)_
- [ ] 4. TailoredUI `UiCapability` adapter for `board`/`agenda`/`task-card`. _(R3)_
- [ ] 5. Wire the foundation orchestrator; inject the test-double agent by default. _(R3, R6)_
- [ ] 6. React/Vite UI: board view, task CRUD, agent panel (utterance→preview→apply/undo),
      inline rejection explanations. _(R1, R3, R4)_
- [ ] 7. Agenda transform proposal + the four violation fixtures (control removal, font-scale
      over limit, non-approved component, disallowed action). _(R3, R4)_
- [ ] 8. Save/reopen/undo integration; revalidate under current policy; tasks untouched. _(R5)_
- [ ] 9. Tests (domain + foundation-integration) and a runnable demo; CI green.
- [ ] 10. Vendor a reproducible runnable copy into `user-tailored-ui/apps/planner/` with
      docs on how it is produced/updated from `user-tailored-planner`. _(compliance)_

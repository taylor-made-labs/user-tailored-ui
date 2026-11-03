# Tasks — Customization Foundation

Status: **implemented** in PR #1 (CI green). Checked items are done and verified.

- [x] 1. Domain types for the customization boundary (tokens, components, controls,
      view, proposal, preferences). _(R1, R2)_
- [x] 2. `CreatorPolicy` representation + invariant kinds (allowed actions, required
      controls, approved components, token rules). _(R1, R2)_
- [x] 3. Deterministic `validateProposal` enforcing all invariants + policy-tampering and
      prototype-pollution guards; never mutates inputs. _(R2, R3)_
- [x] 4. `CustomizationOrchestrator` spine: request → proposal → validation → preview →
      apply → save → reopen → undo, with revalidation + safe fallback. _(R3, R4, R5)_
- [x] 5. Ports: `InferenceProvider`, `CustomizationHistoryStore`, `UiCapability`. _(R6)_
- [x] 6. Labeled test-double adapters: inference + in-memory history. _(R6, R7)_
- [x] 7. Tests: passing+violating per invariant; full flow; rejected-violation-with-
      recoverable-view; user separation; changed-policy rollback. _(R2–R5)_
- [x] 8. GitHub Actions CI (typecheck/lint/test/build) as verification source of truth.
- [x] 9. Public dual license, NOTICE, README, and `.kiro` steering.

## Follow-ups (tracked in other specs)
- [ ] Real Anthropic adapter behind the port → `.kiro/specs/inference-anthropic/`.
- [ ] browser-repos-backed history store → `.kiro/specs/browser-repos-store/`.
- [ ] TailoredUI capability adapter → part of `.kiro/specs/planner-app/`.
- [ ] Planner app (first dogfooding) → `.kiro/specs/planner-app/`.
- [ ] Inventory app (flywheel) → `.kiro/specs/inventory-app/`.

# Requirements — Customization Foundation

Status: **implemented** (PR #1, CI-verified). This spec reverse-documents the shipped
tracer bullet and anchors the invariants the rest of the project builds on.

## Introduction

The foundation provides the shared, app-agnostic mechanism by which an end-user's
natural-language requests and model proposals become **validated** changes to their view,
while the creator's rules are always enforced. It is the spine both the Planner and
Inventory apps drive.

## Glossary

- **Creator Policy** — the single trusted, versioned rule definition. Creator-owned.
- **Defaults** — the app's trusted shipped baseline (must satisfy policy).
- **User Preferences** — untrusted, user/agent-produced selections within policy-allowed ranges.
- **Proposal** — an untrusted, data-only requested transformation of a view.
- **Invariant** — a deterministically checkable rule whose violation causes rejection.
- **View** — a data-only descriptor (tokens, components, controls, actions). Never code.

## Requirements

### R1 — Explicit, trusted, separate creator policy
**User story:** As a creator, I want my rules defined in one explicit, versioned place
separate from defaults and user preferences, so they cannot be edited by users or the model.
**Acceptance (EARS):**
- WHEN the system loads a policy THEN it SHALL treat the policy as read-only with respect to
  any proposal or preference.
- WHEN a proposal attempts to write a policy-reserved key THEN the system SHALL reject it and
  cite a policy-tampering invariant.
- The policy SHALL carry a `version` used to validate/migrate saved state.

### R2 — Concrete, checkable invariants
**User story:** As a creator, I want to declare allowed actions, required controls, and
measurable visual limits, so customization cannot break my app's rules or brand.
**Acceptance:**
- The policy SHALL express: allowed actions, required controls, an approved-component
  allow-list, and per-token rules (enum sets, numeric ranges, booleans).
- Each invariant SHALL have both a passing and a violating test (R-removed control,
  visual-limit violation, disallowed action, policy/validation tampering).

### R3 — Deterministic validation before activation
**User story:** As a user, I want proposed changes checked deterministically before they
apply, so an invalid change is never shown as applied.
**Acceptance:**
- WHEN a proposal is received THEN the system SHALL validate the proposal AND the resulting
  view against the policy BEFORE preview/apply.
- IF validation fails THEN the system SHALL return structured rejection reasons citing the
  specific offending rule, and SHALL NOT mutate the committed view.
- Validation SHALL be independent of the model and SHALL never execute proposal-supplied code.

### R4 — Enforced end-to-end flow
**User story:** As a user, I want request → proposal → validation → preview → apply → save →
reopen → undo to work reliably, so I can customize and recover safely.
**Acceptance:**
- The orchestrator SHALL implement this flow with no app-specific logic.
- WHEN a view is reopened or rolled back THEN it SHALL be revalidated under the CURRENT
  policy; IF invalid THEN the system SHALL fall back to a safe (defaults) view and flag it.

### R5 — Separation and recoverability of customization state
**User story:** As a user, I want my customization history separate from business data and
from other users, so rollback never affects tasks/stock, other users, or creator defaults.
**Acceptance:**
- Saved state SHALL be scoped strictly by (userId, appId).
- Saved state SHALL be versioned against app and policy versions.
- Rollback SHALL change only the user's customization state.

### R6 — Ports for swappable infrastructure
**User story:** As a developer, I want inference, history storage, and UI capability behind
interfaces, so TailoredUI/browser-repos/providers can be swapped and tested.
**Acceptance:**
- The system SHALL define `InferenceProvider`, `CustomizationHistoryStore`, and
  `UiCapability` ports, and SHALL depend only on these (never concrete providers).
- A labeled test-double SHALL exist for inference and history for deterministic CI.

### R7 — Honesty
**User story:** As a judge/user, I want simulated results clearly labeled, so reliability is
never overstated.
**Acceptance:**
- Any test-double/fallback result SHALL report `simulated: true` and its provider id.

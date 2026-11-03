# Design — Customization Foundation

Status: **implemented** (PR #1). This documents the shipped architecture.

## Architecture (ports & adapters / hexagonal)

```
                        ┌───────────────────────────────┐
   natural language →   │  CustomizationOrchestrator     │
                        │  (the enforced-flow spine)      │
                        └──┬──────────┬──────────┬────────┘
                           │          │          │
                  InferenceProvider   │   CustomizationHistoryStore
                   (port)             │        (port)
             ┌─────────┴───────┐      │     ┌────┴─────────────┐
    AnthropicAdapter   TestDoubleAdapter    browser-repos   InMemory
    (later)            (labeled, now)       store (later)   (now)
                           │
                  validateProposal(policy, base, proposal)  ← deterministic, pure
                           │
                      UiCapability (port) → TailoredUI adapter (later)
```

The **domain** (`src/domain/customization/`) is pure: policy, types, validator,
orchestrator. No React, model, or storage imports.

## Key decisions

- **Data-only proposals.** Proposals carry tokens (primitive values), allow-listed component
  refs, control refs, and action names — never code. Rules out `eval`/dynamic execution.
- **Validator is the guarantee.** The model only proposes; `validateProposal` is
  deterministic and model-independent. It checks the proposal AND the resulting view.
- **Defense in depth.** `applyAndSave` and reopen/undo re-run validation against the current
  policy, so stale/tampered state can't slip through.
- **Policy tampering + prototype pollution guards.** Reserved keys (`version`,
  `allowedActions`, …, `__proto__`, `constructor`, `prototype`) are rejected outright.
- **Scoped history.** `(userId, appId)` key enforces user separation at the store boundary.
- **Honest labeling.** Every inference response reports `providerId` + `simulated`.

## Error handling

- Validation failure → structured `RejectionReason[]` (invariant kind, subject, message);
  committed view untouched; last valid view recoverable via reopen.
- Inference failure → typed `InferenceError` (`auth|quota|rate-limit|network|…`) so callers
  surface quota/auth/network honestly and fall back to a recoverable valid view.
- Incompatible saved state on reopen/rollback → safe fallback to defaults, flagged.

## Testing strategy

- Unit: one passing + one violating case per invariant (`test/validator.test.ts`).
- Flow: full tracer bullet, rejected-violation-with-recoverable-view, user separation,
  changed-policy rollback fallback (`test/flow.test.ts`).
- Deterministic (test-double adapters); verified in GitHub Actions CI.

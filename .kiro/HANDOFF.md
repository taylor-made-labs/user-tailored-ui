# Session handoff / resume state

Snapshot so any surface (Kiro Web, IDE, CLI, or Crew) can resume this project instantly.
All config uses the unified `.kiro/` formats, so switching surfaces loses no work.

## Where things stand

- **user-tailored-ui** — main submission repo. `main` has the seed (licenses, README,
  public `.kiro` steering). Branch **`feat/foundation-domain-ports`** = **PR #1**, all
  checks green (CI `verify` + `agent-review` + auto-merge evaluated). PR #1 is **held for
  human approval** because it touches sensitive paths (validator/orchestrator/licenses);
  add the `human-approved` label to let auto-merge squash it in.
- **browser-repos, user-tailored-planner, user-tailored-inventory** — empty repos on `main`,
  not yet seeded.
- **TailoredUI** — the fork, untouched on `main` (branches: aman, develop, dummy, fixes).

## What's built (PR #1)

- Pure domain customization boundary + deterministic validator (all invariants + policy-
  tampering / prototype-pollution guards).
- `CustomizationOrchestrator`: request → proposal → validation → preview → apply → save →
  reopen → undo, with revalidation + safe fallback.
- Ports: inference, customization-history, ui-capability. Labeled test-double adapters.
- Tests: passing+violating per invariant, full flow, user separation, changed-policy
  rollback. Verified by GitHub Actions CI.
- Specs (`.kiro/specs/customization-foundation` implemented, `planner-app` planned),
  scoped steering, committed reviewer agent, devto MCP config, and the auto-merge pipeline.

## Next planned step

Execute `.kiro/specs/planner-app/` — the clickable Planner vertical slice on the labeled
test-double agent (no API key needed): tasks workflow + agenda customization + the required
rejected-violation demo with a recoverable valid view.

## Environment notes (important)

- This was built on **Kiro Web** (`INTEGRATIONS_ONLY`: no sandbox internet; git via the
  Kiro gateway; `npm install`/build/test run in **GitHub Actions CI**, the source of truth).
- **Crew-only features NOT available on Web** and therefore NOT relied upon here: persistent
  "learns how you work" memory, and cron/heartbeat/webhook "works while you're away"
  automation. If resuming under full Kiro Crew, these can now be layered on top of the
  existing specs/steering/agents.

## Pending decisions / inputs needed

- **Anthropic key** (for the real inference adapter + managed demo): add `ANTHROPIC_API_KEY`
  as a GitHub Actions secret when ready. Not needed for the test-double path.
- **DEV token** (`DEVTO_API_KEY`) for blog drafts via MCP: provide via Web/Crew secret
  config, never committed.
- Approve/merge PR #1 (add `human-approved` label) to let the auto-merge loop complete.

# Development notes & evidence

This file records how we develop and verify, and known environment constraints — kept
public per the hackathon requirement.

## Verification model

- The development sandbox is network-restricted (`INTEGRATIONS_ONLY`): it **cannot reach
  the npm registry**, so `npm install` / build / test are **not run in the sandbox**.
- **GitHub Actions CI is the source of truth for "it runs."** Every push/PR runs
  typecheck → lint → test → build. See `.github/workflows/ci.yml`.
- All TypeScript is written against strict settings and checked with the editor's language
  server before pushing; logic correctness is then confirmed by CI.

## Lockfile

Because the sandbox has no registry access, `package-lock.json` could not be generated
locally. It was produced by the first green CI run and committed to the repo, so installs
are now fully reproducible via `npm ci`. When dependencies change and the sandbox still
lacks npm access, regenerate the lockfile via CI (temporarily upload it as an artifact) and
commit the result.

## What this PR delivers (tracer bullet)

The narrowest end-to-end slice of the enforced customization flow, with no app-specific
logic yet:

- Pure domain: `CreatorPolicy`, invariant kinds, deterministic `validateProposal`.
- The `CustomizationOrchestrator` spine:
  `request → proposal → validation → preview → apply → save → reopen → undo`.
- Three hexagonal ports: inference, customization-history, ui-capability.
- Labeled test-double adapters (inference + in-memory history) — honestly marked
  `simulated`.
- Tests: one passing + one violating case per invariant, the full flow, a rejected
  violation with a recoverable valid view, user separation, and changed-policy rollback
  fallback.

Not yet included (later PRs): the real Anthropic adapter, the browser-repos-backed store,
the TailoredUI capability adapter, and the Planner UI.

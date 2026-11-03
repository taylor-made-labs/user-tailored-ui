---
inclusion: always
---

# Engineering conventions

## Architecture

- **Ports & adapters (hexagonal)** wherever applicable; mandatory for:
  - **Inference** — `InferenceProvider` port; adapters: `AnthropicAdapter` (first, real,
    `@anthropic-ai/sdk`), `TestDoubleAdapter` (deterministic, labeled). Future: OpenAI/Codex.
  - **Customization history / storage** — port over `browser-repos`; adapters for the
    real IndexedDB-backed store and an in-memory test double.
  - **UI capability** — port over the TailoredUI fork; app code never imports the fork
    directly.
- **Domain layer** (tasks, inventory items, policy, invariants, validation) has **no**
  dependency on React, the model, or storage. It is pure and unit-testable.
- Keep TailoredUI and browser-repos **behind interfaces** so either can be swapped.

## Stack

- TypeScript (strict). React 18 + Vite for app surfaces. Web-first.
- `browser-repos` is framework-agnostic and **MV3-compatible** (bundled deps, no runtime
  CDN, no `eval`).
- Storage is **IndexedDB only** — never `localStorage`, never `chrome.storage`.

## Credentials & secrets

- Never commit, log, export, or embed secrets (keys/tokens) in repo data, remote URLs,
  commits, or logs. Caller/host supplies credentials via hooks.
- BYOK keys live client-side only (in-memory or user-scoped secure storage), never synced
  into customization history or business data.
- Managed/subscription keys live only in the owner's backend env; the browser never sees
  them. The browser talks to a thin broker endpoint.

## Testing

- Deterministic CI uses the **test double** adapter — no network, no secrets, free.
- Every selected invariant: one **passing** + one **violating** test.
- Cover: interrupted operations, reopen, branch/checkout, export/import round-trips,
  invalid saved state, changed-policy rollback, user separation (no production accounts).
- Runnable demos exercise the **real** agent adapter.
- Label everything that is a double or fallback; never present simulated results as real.

## Git / PR workflow

- Five independent repos. Seed each empty repo's first commit on `main` (repo birth), then
  use **feature branches + PRs** for all subsequent work. Never force-push or rewrite `main`.
- For the populated **TailoredUI** fork, never commit to `main` directly — feature branch + PR.
- Pin dependency versions; commit lockfiles. CI runs `npm ci` then build + test.
- `.kiro/` is tracked and public in every repo. Do not add it to `.gitignore`.

## Honesty & reversibility

- Prefer reversible choices. Distinguish facts from assumptions in docs and PRs.
- Surface network/CORS/auth/divergence/quota errors; keep a recoverable valid view.
- Do not overstate reliability. Document enforced scope and known limitations.

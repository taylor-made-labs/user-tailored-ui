---
inclusion: always
---

# Credentials & inference key handling (enforced)

Two auth modes behind the single `InferenceProvider` port. Developers enable one or both.
In every mode the key MUST NOT enter the browser bundle, the repos, git history, logs,
exports, remote URLs, or customization/business data.

## Managed / subscription mode (owner's key)
- The browser NEVER sees the key. It calls a thin **broker endpoint** the owner deploys.
- The broker holds the key in a **server-side environment variable** and forwards to the
  provider. Validation stays client-side and deterministic regardless of mode.
- For the hosted demo, the key is a **deployment secret** on the serving host, configured
  with the PM outside the repo.

## BYOK mode (end-user's key)
- Key lives **client-side only** (in-memory for the session, or the user's own same-origin
  browser storage). Explicitly scrubbed so it can never be written into Git-backed
  customization history, exports, or logs.
- Default routing is **through the broker as pass-through** (broker does not store it).
  Direct browser→provider is an opt-in a developer enables, clearly labeled as key-exposing.

## Development & CI
- Local dev: a **gitignored `.env`** (only `.env.example` with placeholders is committed).
  `.env` / `.env.*` are already ignored.
- **Routine CI never uses a key** — it runs the deterministic test-double adapter.
- A **separate, manually-triggered (gated) CI job** may use a GitHub Actions encrypted
  secret `ANTHROPIC_API_KEY` for a small live smoke test. Not run on every push; not exposed
  to fork PRs.

## Setup the PM performs (when ready)
1. Add `ANTHROPIC_API_KEY` as a GitHub Actions **secret** on the repo (agent cannot set it).
2. For the hosted demo, set the same key as an **env var on the deploy target**.
3. Never paste a key into chat or commit it. A leaked key must be rotated.

## Failure handling
- Map provider failures to typed `InferenceError` kinds (`auth|quota|rate-limit|network|…`).
- On any failure: surface it honestly, keep a recoverable valid view, and (in dev) fall back
  to the labeled test double. No budget ceiling for now — degrade gracefully on quota.

# user-tailored-ui

> Kiroween 2026 — **Skeleton Crew** entry. A reusable, web-first app foundation where
> **end-users customize their experience through an in-app AI agent**, while **creators
> keep control of the app's rules**.

This repo owns the reusable **skeleton**, the **shared customization** logic, the
**integration contracts**, and is the **main hackathon submission**. It is demonstrated by
two distinct applications: a **Planner** and an **Inventory** app.

**Status:** early scaffolding. This README documents intent and the architecture we are
building toward; sections marked _(planned)_ are not yet implemented. We do not overstate
reliability — see [Limitations](#limitations).

## The idea

An end-user asks, in natural language, to adapt the app to how they work ("turn my board
into a focused daily agenda"). A **real model-backed agent** turns that into a **proposed
configuration**. That proposal is **untrusted**: it passes through **deterministic
validation** against the **creator's policy** before anything is applied. If it violates a
rule, it is **rejected with an explanation**, and the last valid view is preserved.

```
request → real-agent proposal → deterministic validation → preview → apply → save → reopen → undo
```

See the full model in [`.kiro/steering/10-customization-boundary.md`](.kiro/steering/10-customization-boundary.md).

## Architecture (ports & adapters)

- **Domain** — pure TypeScript (tasks, items, policy, invariants, validation). No React,
  no model, no storage.
- **Inference port** — `InferenceProvider`. Adapters:
  - **Claude subscription** (`src/adapters/inference/agent-sdk.ts`) — the real agent,
    via the **Claude Agent SDK** on your **Claude subscription** (no API key). See
    [Claude subscription adapter](#claude-subscription-adapter-real-agent-no-api-key).
  - **Test double** (`src/adapters/inference/test-double.ts`) — labeled, deterministic,
    offline. The CI default. OpenAI/Codex later.
- **Storage port** — over [`browser-repos`](https://github.com/taylor-made-labs/browser-repos)
  (IndexedDB-backed Git) for **customization history**, scoped per user+app, separate from
  business data and creator-owned source.
- **UI capability port** — over the [TailoredUI](https://github.com/taylor-made-labs/TailoredUI)
  fork. App code never imports the fork directly.

Credentials support **BYOK** (user supplies their key, client-side only) and **owner-managed
subscription** (owner backend holds the key). Secrets never enter the browser bundle, repo,
logs, or Git history.

## Repository map

| Repo | Role |
|---|---|
| **user-tailored-ui** (this) | Reusable skeleton, shared customization, contracts, submission |
| [TailoredUI](https://github.com/taylor-made-labs/TailoredUI) | Fork — reusable UI capability (MIT, upstream: Aman Singh) |
| [browser-repos](https://github.com/taylor-made-labs/browser-repos) | IndexedDB-backed Git library (independent, reusable) |
| [user-tailored-planner](https://github.com/taylor-made-labs/user-tailored-planner) | Planner app |
| [user-tailored-inventory](https://github.com/taylor-made-labs/user-tailored-inventory) | Inventory app |

Dependencies are consumed at **pinned** versions behind interfaces.

## Runnable demo apps (vendored in this repo)

The two demo apps are included here as **reproducible, runnable copies**, so a fresh clone
of this repo builds and runs both without checking out their source repos:

| Folder | App | Vendored from |
|---|---|---|
| [`apps/planner/`](apps/planner/) | Planner — task planning → focused daily agenda | [user-tailored-planner](https://github.com/taylor-made-labs/user-tailored-planner) |
| [`apps/inventory/`](apps/inventory/) | Inventory — stock tracking → low-stock focus view | [user-tailored-inventory](https://github.com/taylor-made-labs/user-tailored-inventory) |

Each folder has a README recording its exact source commit and the one command to
reproduce/update it ([`scripts/vendor-apps.sh`](scripts/vendor-apps.sh)). CI builds and
tests both copies on every push (`.github/workflows/ci.yml`, job **apps**), so the green
checks on a fresh clone are the proof they run.

## Claude subscription adapter (real agent, no API key)

`src/adapters/inference/agent-sdk.ts` is the **real** inference adapter. It turns a
natural-language request into a customization proposal using the
[**Claude Agent SDK**](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
(`@anthropic-ai/claude-agent-sdk`, pinned to `0.3.318`), authenticated by **your Claude
subscription** — **not** a per-token `sk-ant-` API key.

**How auth works.** The Agent SDK wraps the Claude Code CLI. When you sign in to the
`claude` CLI with your subscription (OAuth), the SDK rides that existing login, and calls
draw on your subscription. This adapter therefore **never reads, requires, embeds, or logs
an API key or any credential** — the login lives in your Claude Code setup, outside this
repo.

**One-time setup** (on your machine, once):

```bash
# 1. Install the Claude Code CLI and sign in with your subscription (OAuth, no key):
npm i -g @anthropic-ai/claude-code      # or your platform's installer
claude                                   # complete the browser OAuth login

# 2. Install the Agent SDK in this repo (it is an optionalDependency; CI never needs it):
npm i --no-save @anthropic-ai/claude-agent-sdk@0.3.318
```

**How it stays safe.** The adapter's output is **data** — a `CustomizationProposal` — and
is **never executed as code**. It is always validated downstream against the creator policy
before anything applies (the provider is never trusted). The SDK query is constrained to a
single **tool-less, single-shot text turn** (`maxTurns: 1`, `allowedTools: []`,
`disallowedTools: ['*']`, `settingSources: []`), so it never runs an autonomous agent loop
or any tool against your machine — it returns a plain text completion only.

**Decoupling.** App code never imports the SDK. The SDK's `query` function is **injected**
into the adapter at the composition root, behind a minimal structural type. So the
foundation's `src/` has no static dependency on the SDK, and the deterministic CI build
stays keyless and login-free.

**Failures are honest.** Each failure maps to a typed `InferenceError` kind
(`auth` / `quota` / `rate-limit` / `network` / `invalid-response` / `unknown`), so callers
surface it plainly and fall back to the labeled test-double in dev — keeping a recoverable
valid view. Results from the real adapter are labeled `simulated: false`; test-double
results are always labeled `simulated: true`. **A simulated result is never presented as
real, and never the reverse.**

**Testing.**

- **Unit tests** (`test/agent-sdk.test.ts`) exercise the adapter with the SDK boundary
  **mocked/injected** — prompt in → proposal out, and each SDK failure → the right typed
  `InferenceError`. No network, no login. These run in CI and stay green.
- **Live smoke test** (`scripts/live-smoke-claude.mjs`, run with `npm run smoke:claude`)
  proves the **real** subscription path end to end. It is **skipped by default**
  (only runs when `RUN_LIVE_CLAUDE=1`), lives outside `test/`, and is invisible to
  typecheck/lint/CI — so CI stays deterministic and keyless. Run it locally after
  `npm run build` and a `claude` login to verify the real path.

## Getting started _(planned)_

Build/test is verified in **GitHub Actions CI** (the dev sandbox has no public network).
Once scaffolded:

```bash
npm ci
npm run test     # deterministic — uses the labeled test-double inference adapter
npm run dev      # runnable demo — uses the real agent adapter (needs a key; see docs)
```

## Adopting the foundation in a new app _(planned, documented as contracts land)_

A new app implements the data/actions/policy/preferences contracts and wires the three
ports; it does **not** copy either example app. Setup, extension points, supported limits,
and offline-vs-model-connected capabilities will be documented here.

## Licensing

Dual-licensed under either **MIT** ([LICENSE-MIT](LICENSE-MIT)) or
**Apache-2.0** ([LICENSE-APACHE](LICENSE-APACHE)), at your option. Third-party and upstream
attributions are in [NOTICE](NOTICE).

## Limitations

- Customization enforcement covers an explicit, finite set of invariants — **not** universal
  correctness. Enforced scope is documented alongside each app.
- The agent's natural-language interpretation is real and therefore variable; validation is
  deterministic and is the actual guarantee. Quota/rate/network failures are surfaced and
  fall back to a recoverable valid view.

## Kiro & Kiroween 2026

Built with [Kiro](https://kiro.dev) using a spec-driven workflow for **Kiroween 2026**.
Specs, steering, and development evidence live in the public [`.kiro/`](.kiro/) directory.

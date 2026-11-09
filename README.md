# user-tailored-ui

> Kiroween 2026 — **Skeleton Crew** entry. A reusable, web-first app foundation where
> **end-users customize their experience through an in-app AI agent**, while **creators
> keep control of the app's rules**.

This repo owns the reusable **skeleton**, the **shared customization** logic, the
**integration contracts**, and is the **main hackathon submission**. It is demonstrated by
two distinct applications: a **Planner** and an **Inventory** app.

**Status:** working demo. Both apps build, test and run from a fresh clone, with customization
history stored in IndexedDB-backed Git. Sections marked _(planned)_ are not yet implemented.
We do not overstate reliability — see [Limitations](#limitations) and
[What is real vs. stubbed](#what-is-real-vs-stubbed).

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
  business data and creator-owned source. **Wired in both apps** (PRs #11, #12): the browser
  entry points use `BrowserReposHistoryStore`; the in-memory double is used by tests and the
  headless `demo.ts`.
- **UI capability port** — an interface (`src/ports/ui-capability.ts`) meant to sit over the
  [TailoredUI](https://github.com/taylor-made-labs/TailoredUI) fork. App code never imports
  the fork directly. **See [What is real vs. stubbed](#what-is-real-vs-stubbed): today the
  demo path does not use the fork.**

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

## What is real vs. stubbed

| Piece | State |
|---|---|
| Policy, validator, orchestrator (enforcement) | **Real**, tested per invariant class |
| Customization history (save / reopen / undo) | **Real**: git commits in IndexedDB via `browser-repos`. The "reload" in tests is simulated with `fake-indexeddb` under Node; no automated real-browser run proves it |
| Inference in demo and CI | **Test double**, labeled `simulated: true`. The Claude adapter is real code, optional, and not exercised in CI |
| UI capability / TailoredUI fork | **Not on the demo path.** Each app ships its own in-repo `TailoredUiCapabilityAdapter`. It resolves components to data-only descriptors and React draws them. It does **not** import the TailoredUI fork. The fork is credited upstream (see [NOTICE](NOTICE)); the port keeps it swappable, but no fork code runs in the demo |
| `browser-repos` in the apps | A vendored tarball built from `browser-repos` commit `369ab3d` (slice 5), not its current `main`. See each `apps/*/README.md` |

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

**Model + thinking level.** The adapter defaults to **Claude Haiku (latest)** at
**`medium`** reasoning effort. These are exported constants (`DEFAULT_MODEL`,
`DEFAULT_EFFORT`) and are passed through to the Agent SDK's `model` and `effort` options —
one place to change, and overridable per-instance via the adapter config (`model`,
`effort`). Bump to `sonnet` or a higher effort there when you want more.

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

## Getting started

The root package is the shared foundation (library + tests). The runnable web apps are in
`apps/`. Needs Node 20+ and network access for `npm ci`. Checked from a fresh clone on
Node 20 and 24; see [`docs/fresh-clone-check.md`](docs/fresh-clone-check.md) for what was
and was not verified.

```bash
git clone https://github.com/taylor-made-labs/user-tailored-ui.git && cd user-tailored-ui

# Foundation: typecheck, lint, tests, build. Keyless; uses the labeled test-double.
npm ci && npm run typecheck && npm run lint && npm test && npm run build

# Each app (apps/planner or apps/inventory):
cd apps/planner
npm ci && npm test && npm run build
npx tsx src/demo.ts     # headless end-to-end demo, offline, no secrets
npm run dev             # web app; Vite prints the local URL
```

There is no `dev` script at the repo root; run it inside an app folder. The demo uses the
labeled test-double, never a real model.

## Adopting the foundation in a new app _(planned, documented as contracts land)_

A new app implements the data/actions/policy/preferences contracts and wires the three
ports; it does **not** copy either example app. Setup, extension points, supported limits,
and offline-vs-model-connected capabilities will be documented here.

## CI/CD pipeline (layered merge gate)

Merges are automated by CI/CD with an independent review-agent gate, so they do **not**
wait on a human — **except** a narrow set of security-sensitive paths, which still require
explicit human approval. The pipeline runs as ordered layers, cheap and deterministic
first, model-backed and optional last. Full spec:
[`.kiro/specs/cicd-pipeline.md`](.kiro/specs/cicd-pipeline.md).

```
push / PR
  → Layer 1  deterministic CI floor       (verify + app matrix)     keyless, gating
  → Layer 2  independent review agent      (agent-review status)     floor always on; model layer optional
  → Layer 3  independent bounded fix agent (fix(agent): commits)     keyless no-op default; optional model layer
  → Layer 4  auto-merge                    (squash on green + PASS)  human-approved label = only hold
```

| Layer | Where | What runs | Automatic? |
|---|---|---|---|
| **1. CI floor** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | `verify` (`npm ci` → `scripts/dep-hygiene.mjs` → typecheck → lint → test → build) + `app (planner)` / `app (inventory)` matrix | Yes — keyless, green on a fresh clone |
| **2. Review agent** | [`.github/workflows/agent-review.yml`](.github/workflows/agent-review.yml) | Deterministic floor `scripts/boundary-check.mjs` posts the `agent-review` status; optional semantic agent ([`.kiro/agents/customization-boundary-reviewer.json`](.kiro/agents/customization-boundary-reviewer.json)) adds judgment and can block | Floor always on; model layer landed as **PR #7** (awaiting `human-approved`) |
| **3. Fix agent** | bounded self-heal (max 2) | Proposes `fix(agent):` commits on the PR branch only; refuses sensitive paths; never merges or relaxes CI | Keyless advisory no-op by default; model layer landed as **PR #8** (awaiting `human-approved`) |
| **4. Auto-merge** | [`.github/workflows/auto-merge.yml`](.github/workflows/auto-merge.yml) | Squash-merges when `verify` green **and** `agent-review` PASS **and** (no sensitive path **or** `human-approved` label) | Yes — keyless |

**Automatic vs. held for a human.** Ordinary app / UI / doc / test / adapter changes match
no sensitive path and auto-merge on green. The **only** hold is the `human-approved` label,
and it applies only to a narrow sensitive set: the enforcement domain
(`src/domain/customization/validator.ts`, `orchestrator.ts`, `policy.ts`), the enforcement
tooling (`scripts/boundary-check.mjs`, `scripts/dep-hygiene.mjs`), vendored enforcement
(`apps/**/foundation/**`), the gate itself (`.github/workflows/*.yml`), and
licensing / secret paths (`LICENSE*`, `broker`, `secret` / `credential` / `.env`). The
review and fix agents can **never** relax CI — auto-merge independently requires `verify` to
be green.

**What is real vs. optional.** Routine CI (`verify`, the app matrix, `dep-hygiene`,
`boundary-check`, auto-merge) is **keyless, deterministic, and green on a fresh clone with
no secrets**. The model-backed halves of Layers 2 and 3 are **optional**: with no key
present they degrade honestly to the deterministic floor (reviewer) or a logged no-op (fix
agent), and that state is labeled, not hidden. Fork PRs never get secret access, so the
model-backed layers degrade to the floor there too.

**Enabling the optional model-backed layers.** The deterministic pipeline needs nothing. To
turn on the live reviewer and fix agent, add a repository secret named **`ANTHROPIC_API_KEY`**
in **GitHub → Settings → Secrets and variables → Actions** (you set it yourself — no agent
or workflow ever stores a credential), then merge PR #7 and PR #8 (both need the
`human-approved` label first, because they touch `.github/workflows/`).

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

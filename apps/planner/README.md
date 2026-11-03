# Planner — vendored runnable copy

> Kiroween 2026 **Skeleton Crew**. This folder is a **reproducible, runnable copy** of the
> Planner app, vendored into the submission repo so a fresh clone of
> [user-tailored-ui](https://github.com/taylor-made-labs/user-tailored-ui) builds and runs
> both demo apps with no access to their source repos.

## Vendoring provenance

| | |
|---|---|
| Authoritative source | [taylor-made-labs/user-tailored-planner](https://github.com/taylor-made-labs/user-tailored-planner) |
| Source ref | `feat/planner-slice` |
| Source commit (SHA) | `94e0fbe9e82c6bba9880f0a0c42caa356e082b36` |
| Copied by | [`scripts/vendor-apps.sh`](../../scripts/vendor-apps.sh) (repo root) |

**Why the slice branch, not `main`:** the app repo's `main` currently holds only the
project scaffold (seed PR #1). The full, implemented vertical slice (spec tasks 1–9) lives
on the `feat/planner-slice` branch — an accepted, CI-green pull request whose merge into the
app repo's protected `main` is human-gated because it vendors the foundation's enforcement
code into the app. That gating is about the *app repo's* main branch, not about the app's
readiness: the slice is the real, verified, runnable Planner, so it is what we vendor here.

## How to reproduce / update this copy

From the repo root:

```bash
# Re-vendor at the pinned commit recorded above:
scripts/vendor-apps.sh

# Or update to a newer Planner commit / ref:
PLANNER_REF=<new-sha-or-branch> scripts/vendor-apps.sh
```

Then review `git status`, commit the result (including `package-lock.json`), and open a PR.
The repo-root CI (`.github/workflows/ci.yml`, job **apps**) runs
`npm ci && npm run typecheck && npm run lint && npm run test && npm run build` in this
directory — that green check is the proof the copy is runnable.

### What is and isn't copied

Copied (everything needed to build/test on its own): `src/`, `test/`, `package.json`,
`package-lock.json` (exact pinned deps), `tsconfig.json`, `vite.config.ts`,
`vitest.config.ts`, `index.html`, and the public `.kiro/` (specs + steering — tracked dev
evidence). Excluded: `.git`, `node_modules`, `dist`, the app's own `.github/` CI (the
repo-root CI verifies the copy instead), and the app's `LICENSE-*` / `.env.example`
(this repo is dual-licensed at the root — see below).

## What the Planner is

A task-planning app built on the shared `user-tailored-ui` foundation. Users create, edit,
organize, and complete tasks (persisted in IndexedDB), then use an in-app AI agent to
customize a board into a focused daily agenda in natural language. The agent's proposal is
**untrusted**: it is validated against the creator's policy before anything is applied, and
a violating request is rejected with an explanation while the last valid view is preserved.

```
request → agent proposal → deterministic validation → preview → apply → save → reopen → undo
```

The default agent is the labeled offline **test-double** (`providerId: "test-double"`,
`simulated: true`) — deterministic, no API key, safe for CI and demos.

## Run it

```bash
npm ci
npm run dev          # runnable web app (board + agent panel)
npx tsx src/demo.ts  # headless end-to-end demo (offline, no secrets)
```

## Licensing

Dual-licensed **MIT OR Apache-2.0**, matching this app's `package.json`. The full license
texts and attributions live at the submission repo root
([LICENSE-MIT](../../LICENSE-MIT), [LICENSE-APACHE](../../LICENSE-APACHE),
[NOTICE](../../NOTICE)) and cover the whole tree, this folder included.

For the full app documentation (architecture, ports & adapters, limitations), see the
[authoritative repo README](https://github.com/taylor-made-labs/user-tailored-planner).

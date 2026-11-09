# Inventory — vendored runnable copy

> Kiroween 2026 **Skeleton Crew**. This folder is a **reproducible, runnable copy** of the
> Inventory app, vendored into the submission repo so a fresh clone of
> [user-tailored-ui](https://github.com/taylor-made-labs/user-tailored-ui) builds and runs
> both demo apps with no access to their source repos.

## Vendoring provenance

| | |
|---|---|
| Authoritative source | [taylor-made-labs/user-tailored-inventory](https://github.com/taylor-made-labs/user-tailored-inventory) |
| Source ref | `main` |
| Source commit (SHA) | `0ec29fa3c7c1842aa90356b3b292aea085052aa4` |
| Copied by | [`scripts/vendor-apps.sh`](../../scripts/vendor-apps.sh) (repo root) |

### Local changes on top of the pinned commit

This copy is **not** a pure copy of the pin. PR #12 added, after vendoring:

- `src/adapters/history-browser-repos.ts` (customization history stored as git commits in
  IndexedDB) and its wiring in `src/main.tsx` / `src/App.tsx`;
- `test/history-persistence.test.ts` and `test/setup.ts`;
- the `@taylor-made-labs/browser-repos` dependency, as `vendor/taylor-made-labs-browser-repos-0.1.0.tgz`.

Pin is current: it is the head of the source repo's `main` as of 2026-11-09.

**`browser-repos` pin.** The tarball's `dist/` is byte-identical to a fresh `npm ci && npm run build`
of [browser-repos](https://github.com/taylor-made-labs/browser-repos) at commit
`369ab3d` (slice 5). Checked 2026-11-09. It is **older than** browser-repos `main`
(`98fb9ad`, slices 6 and 7), so the public-API-surface and remote-sync slices are not in this
app. The tarball's `package.json` was written by hand; it is not the output of `npm pack`.

**Re-vendoring caveat.** `scripts/vendor-apps.sh` deletes and re-copies this folder from the
source repo, which would **remove the changes above**. The "one command to reproduce" below
reproduces the pinned source only, not the history wiring. Re-apply PR #12 after
running it. This is a known gap (see `.kiro/specs/submission/tasks.md`).

## How to reproduce / update this copy

From the repo root:

```bash
# Re-vendor at the pinned commit recorded above:
scripts/vendor-apps.sh

# Or update to a newer Inventory commit / ref:
INVENTORY_REF=<new-sha-or-branch> scripts/vendor-apps.sh
```

Then review `git status`, commit the result (including `package-lock.json`), and open a PR.
The repo-root CI (`.github/workflows/ci.yml`, job **apps**) runs
`npm ci && npm run typecheck && npm run lint && npm run test && npm run build` in this
directory — that green check is the proof the copy is runnable.

### What is and isn't copied

Copied (everything needed to build/test on its own): `src/`, `test/`, `package.json`,
`package-lock.json` (exact pinned deps), `tsconfig.json`, `vite.config.ts`,
`vitest.config.ts`, `index.html`, `CONTRIBUTING.md`, and the public `.kiro/` (steering —
tracked dev evidence). Excluded: `.git`, `node_modules`, `dist`, the app's own `.github/`
CI (the repo-root CI verifies the copy instead), and the app's `LICENSE-*` / `.env.example`
(this repo is dual-licensed at the root — see below).

## What the Inventory app is

A stock-tracking app built on the shared `user-tailored-ui` foundation, through its public
ports only. Users track inventory items (quantity, location, low-stock threshold), persisted
in IndexedDB, then use an in-app AI agent to customize the catalog into a low-stock focus
view in natural language. As with the Planner, the agent's proposal is **untrusted**: it is
validated against the creator's policy before anything is applied, and a violating request
is rejected with an explanation while the last valid view is preserved.

```
request → agent proposal → deterministic validation → preview → apply → save → reopen → undo
```

The default agent is the labeled offline **test-double** (`providerId: "test-double"`,
`simulated: true`) — deterministic, no API key, safe for CI and demos.

## Run it

```bash
npm ci
npm run dev          # runnable web app (catalog + agent panel)
npx tsx src/demo.ts  # headless end-to-end demo (offline, no secrets)
```

## Licensing

Dual-licensed **MIT OR Apache-2.0**, matching this app's `package.json`. The full license
texts and attributions live at the submission repo root
([LICENSE-MIT](../../LICENSE-MIT), [LICENSE-APACHE](../../LICENSE-APACHE),
[NOTICE](../../NOTICE)) and cover the whole tree, this folder included.

For the full app documentation (architecture, ports & adapters, limitations), see the
[authoritative repo README](https://github.com/taylor-made-labs/user-tailored-inventory).

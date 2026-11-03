---
inclusion: always
---

# user-tailored-inventory — project scope

## What this repo is

The **Inventory** app: the second application that adopts the **user-tailored-ui**
foundation, for the Kiroween 2026 **Skeleton Crew** category. It is the "flywheel" proof —
the SAME foundation, adopted a second time through its public ports ONLY, should cost
**dramatically less** than the Planner did and re-use everything the foundation owns.

A stock-tracking app: users **create, edit, adjust quantity, and delete items** (name,
quantity, location/category, low-stock threshold), then use the **in-app agent** to customize
the catalog into a **low-stock focus view** — hiding healthy items while preserving every
item's identity, the required quantity-adjust control, and the creator's constraints.

## Where this repo sits (5-repo project)

1. **user-tailored-ui** — reusable skeleton, shared customization, contracts, main submission.
2. **TailoredUI** (fork) — reusable UI capability (MIT, upstream: Aman Singh).
3. **browser-repos** — IndexedDB-backed Git library (independent, reusable).
4. **user-tailored-planner** — the task-planning app.
5. **user-tailored-inventory** — this repo, the inventory app.

## Flywheel mandate (why this app exists)

- This app must be **genuinely DISTINCT** from the Planner: different domain (stock items,
  not tasks), different workflow (adjust-quantity, low-stock), different customization story
  (a **low-stock focus view**, not a daily agenda).
- Adopting the foundation a second time must be **cheap**. If something has to be re-solved
  here that the foundation should really own, that friction is **noted in the PR body** as
  honest hackathon evidence rather than papered over with new app-side internals.

## Scope rules (non-negotiable)

- **Adopt the foundation through its public exports and ports only.** No reaching into
  foundation internals. Do **not** copy the Planner app's domain; do not duplicate shared
  customization logic that belongs in the foundation.
- The `@taylor-made-labs/user-tailored-ui` package is **not published yet**, so its public
  entrypoint is VENDORED into `src/foundation/` and consumed through the single port
  `src/ports/foundation.ts`. When it publishes, that port re-points at the pinned package
  and `src/foundation/` is deleted — no other app code changes.
- **No arbitrary generated code executes in the app.** The agent emits validated
  configuration / tokens / approved-component references only — data, never code (no `eval`).
- **User requests and model proposals are untrusted.** They cannot bypass policy or
  validators. Validate before every activation (the proposed config AND the resulting view);
  explain rejections; keep a recoverable valid view (Policy > Defaults > Preferences).
- **`.kiro/` is public and never gitignored** (hackathon requirement — judges must see
  specs, steering, and development evidence in a fresh clone).

## Locked decisions (inherited from the project)

- **License:** dual-licensed `MIT OR Apache-2.0`.
- **Verification:** author + commit in the sandbox; **GitHub Actions CI** is the source of
  truth for "it runs" (`npm ci` → typecheck → lint → test → build).
- **Tech surface:** TypeScript (strict) + React 18 + Vite; `vitest` for tests. Pin exact
  versions and commit the lockfile.
- **Persistence:** business data is **IndexedDB only** — never localStorage, never
  chrome.storage. Business items and customization history live in SEPARATE stores.
- **Honesty:** label test doubles and fallbacks; do not overstate reliability; distinguish
  facts from assumptions.

## Working agreement

- Spec-driven: requirements → design → tasks.
- This repo is seeded and built in ONE feature branch and ONE non-draft PR: the item domain,
  the IndexedDB item store, the CreatorPolicy, the low-stock-focus customization, the
  foundation orchestrator wiring, the React/Vite UI, the four violation fixtures (each with a
  passing and a violating test), save/reopen/undo, a headless demo, and CI green.

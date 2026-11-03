---
inclusion: always
---

# user-tailored-planner — project scope

## What this repo is

The **Planner**: the first application that adopts the **user-tailored-ui** foundation, for
the Kiroween 2026 **Skeleton Crew** category. It proves the foundation's customization flow
in a real, persistent workflow before the Inventory app repeats it.

A task-planning app: users **create, edit, organize, and complete tasks**, then use the
**in-app agent** to **customize a board into a focused daily agenda** — while preserving task
identities, contents, actions, and the creator's constraints.

## Where this repo sits (5-repo project)

1. **user-tailored-ui** — reusable skeleton, shared customization, contracts, main submission.
2. **TailoredUI** (fork) — reusable UI capability (MIT, upstream: Aman Singh).
3. **browser-repos** — IndexedDB-backed Git library (independent, reusable).
4. **user-tailored-planner** — this repo, the task-planning app.
5. **user-tailored-inventory** — the inventory app.

## Scope rules (non-negotiable)

- **Adopt the foundation through its public exports and ports only.** No reaching into
  foundation internals. Do **not** copy the Inventory app, and do not duplicate shared
  customization logic that belongs in the foundation.
- The `@taylor-made-labs/user-tailored-ui` package is **not published yet**. This repo does
  not depend on it until it is, and then only as a **pinned** version behind interfaces.
- **No arbitrary generated code executes in the app.** The agent emits validated
  configuration / tokens / approved-component references only.
- **User requests and model proposals are untrusted.** They cannot bypass policy or
  validators. Validate before every activation; explain rejections; keep a recoverable valid
  view.
- **`.kiro/` is public and never gitignored** (hackathon requirement — judges must see
  specs, steering, and development evidence in a fresh clone).

## Locked decisions (inherited from the project)

- **License:** dual-licensed `MIT OR Apache-2.0`.
- **Verification:** author + commit in the sandbox; **GitHub Actions CI** is the source of
  truth for "it runs" (`npm ci` → typecheck → lint → test → build).
- **Tech surface:** TypeScript (strict) + React 18 + Vite; `vitest` for tests. Pin exact
  versions and commit the lockfile.
- **Honesty:** label test doubles and fallbacks; do not overstate reliability; distinguish
  facts from assumptions.

## Working agreement

- Spec-driven: requirements → design → tasks, iterated with the PM before large builds.
- This commit is the **seed scaffold only**. The Planner build (task workflow, agenda
  customization, policy validation, save/reopen/undo) is a later task.

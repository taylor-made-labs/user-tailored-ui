# Design — Kiroween 2026 Submission (how the four repos become one entry)

Status: **authoritative.** Describes how the skeleton + two apps + the browser-storage
library + the UI fork fit together into a single Skeleton Crew submission, the demo flow
across them, what is real vs. stubbed vs. optional, and how it is run and demoed. Pairs with
`requirements.md` (the acceptance bars) and `tasks.md` (the gap audit).

## 1. One submission, one clone

A judge clones exactly **one** repo — `user-tailored-ui` — and everything needed to see the
story is inside it. The other repos are the *sources of record* for their independent pieces,
but the submission does not require a judge to clone them.

```
                         ┌─────────────────────────────────────────────┐
   judge clones  ───────▶│  user-tailored-ui   (SUBMISSION REPO)        │
                         │                                              │
                         │  src/            reusable skeleton:          │
                         │    domain/       policy, validator,          │
                         │                  orchestrator (enforcement)  │
                         │    ports/        inference | history | ui    │
                         │    adapters/     test-double + Claude SDK     │
                         │                                              │
                         │  apps/planner/     vendored runnable app  ───┼──▶ user-tailored-planner (source)
                         │  apps/inventory/   vendored runnable app  ───┼──▶ user-tailored-inventory (source)
                         │                                              │
                         │  .kiro/          specs + steering + agents   │
                         │  .github/        the layered CI/CD gate      │
                         └───────────────┬──────────────────────────────┘
                                         │ (intended, see §4 gap)
                                         ▼
                              browser-repos (IndexedDB-backed Git)
                                         │
                              TailoredUI fork (UI capability)
```

## 2. The five repos and their jobs

| Repo | Job in the submission | How the submission uses it |
|---|---|---|
| **user-tailored-ui** | The skeleton + shared enforcement + the thing judged | Cloned directly; holds `src/` + both vendored apps |
| **user-tailored-planner** | App #1 source of record | Vendored into `apps/planner/` at a pinned commit |
| **user-tailored-inventory** | App #2 source of record | Vendored into `apps/inventory/` at a pinned commit |
| **browser-repos** | IndexedDB-backed Git for customization history | Intended behind the `CustomizationHistoryStore` port |
| **TailoredUI** (fork) | Reusable UI capability | Behind the `UiCapability` port; app code never imports it directly |

**Why two separate apps matter:** the category reward is a *reusable* skeleton. Planner
(tasks → focused daily agenda) and Inventory (stock → low-stock focus view) have different
domains, different policies (complete-task control vs. adjust-qty control; agenda vs.
low-stock-view components), and different transforms — so the same enforcement core carrying
both is the proof it generalizes.

## 3. The demo flow across the repos (the R1 path, mapped to code)

```
  USER (natural language)
       │  "turn my board into a focused daily agenda"
       ▼
  AgentPanel (apps/planner/src/ui/AgentPanel.tsx)
       │  utterance
       ▼
  InferenceProvider port  ──▶ test-double adapter   (default, offline, simulated:true)
       │                  └─▶ Claude Agent SDK adapter (optional, real, simulated:false)
       ▼
  CustomizationProposal   (DATA — never executed)
       │
       ▼
  validateProposal()  ◀── CreatorPolicy (trusted, versioned)
       │   deterministic: invariants + resulting-view check + tampering guards
       ├── FAIL ─▶ reasons[] cite the rule ─▶ UI explains, keeps last valid view
       └── PASS ─▶ preview ─▶ apply ─▶ save ──▶ CustomizationHistoryStore port
                                                   ├─▶ in-memory double (default today)
                                                   └─▶ browser-repos adapter (intended, §4)
       ▼
  reopen / undo  ──▶ revalidate under current policy ──▶ safe fallback if stale
```

Business data (tasks / stock) lives behind a **separate** store port (`TaskStore` /
`ItemStore`, IndexedDB), so customization can never corrupt or escalate business state.
This separation is the architectural spine and is tested directly (see the integration tests'
"never touch business data" cases).

## 4. What is real vs. stubbed vs. optional vs. unmerged (the honesty table)

This is the section judges and the PM should read first. It is graded from the **actual
code and PR state**, not from READMEs.

| Capability | State | Evidence / where |
|---|---|---|
| Enforcement core (policy, validator, orchestrator) | **Real, product-ready** | `src/domain/customization/*`, merged on `main` (PR #1); invariant pass+fail tests |
| Four violation classes rejected with cited rule | **Real** | Planner + Inventory integration tests, each of 4 classes |
| Save / reopen / undo, user separation | **Real** (over in-memory history) | integration tests drive the full flow |
| Planner app (vendored) | **Real, runnable** | `apps/planner/*`, own green `app (planner)` CI job |
| Inventory app (vendored) | **Real, runnable** | `apps/inventory/*`, own green `app (inventory)` CI job |
| Test-double inference adapter | **Real, labeled `simulated:true`** | `src/adapters/inference/test-double.ts` |
| Claude Agent SDK adapter (real model) | **Real code, OPTIONAL at runtime** | `src/adapters/inference/agent-sdk.ts`; needs a subscription login; off by default |
| CI/CD layered merge gate | **Real deterministic floor; model layers optional** | `.github/workflows/*`, `.kiro/specs/cicd-pipeline.md` |
| **Customization history over browser-repos** | **STUBBED — not wired** | port exists; default adapter is **in-memory**; `package.json` has **no** browser-repos dep |
| **browser-repos library capability** | **PARTIAL on `main`** | `main` = seed + Slice 1 (lifecycle); Slices 2–7 are green but **unmerged** stacked PRs #3–#8 |
| **browser-repos MV3 / IndexedDB-git in the apps** | **Not demonstrated end-to-end** | no app actually persists customization through browser-repos |
| TailoredUI fork wiring | **Port-only** | `UiCapability` port + in-repo adapter; fork not vendored into the demo path |
| **user-tailored-planner `main`** | **STUB** | real slice is **open PR #2**; `main` is a seed shell |
| Demo URLs (public, hosted) | **Missing** | no deployment yet |
| <3-min YouTube demo | **Missing** | not recorded |

**Headline:** the *enforcement idea* and the *two apps* are product-ready and dogfood the
skeleton honestly. The *storage story* (browser-repos → customization history) is the biggest
real-vs-claimed gap: it is architecturally designed and the library is largely built, but it
is **not connected** to either app's runtime, and most of the library is unmerged.

## 5. How it is run and demoed

### Offline, deterministic (the default, keyless)
```bash
# host: whichever machine clones the submission repo
npm ci
npm test            # labeled test-double inference; no key, no network
npm run build
# each app:
cd apps/planner   && npm ci && npm run dev    # http://localhost:5173
cd apps/inventory && npm ci && npm run dev
```
Everything in the R1 demo path works here — including the rejection beat — with **no key**.

### Optional real-agent path
Sign in to the Claude CLI (OAuth subscription, no `sk-ant-` key) and inject the SDK at the
composition root; results flip to `simulated:false`. Off by default so CI stays keyless.

### For judges who won't clone
Deploy both apps as static sites (offline-first on the test-double) and publish the URLs
(R3). This is a remaining task (`tasks.md`), not done today.

## 6. CI/CD as development evidence

The layered merge gate (`.kiro/specs/cicd-pipeline.md`) is itself a submission artifact: a
deterministic keyless floor (`verify` + app matrix + boundary-check + dep-hygiene +
auto-merge) that is green on a fresh clone, with optional model-backed review/fix layers that
degrade honestly when no key is present. It demonstrates agentic CI/CD without overstating —
the model layers are off unless a secret is set, and that state is labeled.

## 7. Design risks called out

- **Storage gap (highest impact).** The submission's distinctive storage claim
  (IndexedDB-git customization history) is not reachable at runtime. Either wire a
  browser-repos adapter behind the history port in at least one app, or restate the claim as
  intent in README + this design. Leaving it as-is risks an overstatement finding from judges.
- **Unmerged library.** A judge cloning `browser-repos` sees a seed. The stacked PRs must
  land on `main` (rebased into a clean `#2→#8` order per the known tangled-base issue) or the
  README must state where the real code is.
- **Stub standalone planner.** `user-tailored-planner` `main` misleads; its real slice is PR
  #2. Merge it or add a README pointer to `apps/planner`.
- **No hosted demo / video.** Presentation dimension (R0.7) is currently unmet.

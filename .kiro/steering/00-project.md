---
inclusion: always
---

# Kiroween 2026 — Skeleton Crew Entry

## What we are building

A reusable **app foundation** ("user-tailored UI") plus **two working applications** that
prove it, for the Kiroween 2026 hackathon **Skeleton Crew** category (a lean, flexible
template demonstrated by two distinct apps).

- **End-users** customize their own experience through an **in-app agent** (real
  model-backed natural language), while **creators** (app owners/developers) retain
  control of the app's rules.
- The core challenge: **reliable coexistence** of user preferences and model-generated
  changes with creator-owned rules, on a **narrow web-first surface**, using the
  **simplest enforceable representation** (validated configuration, tokens, approved
  components) — not a general policy framework and not universal-correctness research.

## Repositories & ownership (independent repos, this order of responsibility)

1. **TailoredUI** (fork of `TailoredUI/TailoredUI`) — reusable UI capabilities. Fix/extend
   only what our product needs. Keep clear commits + brief notes for possible upstream PRs
   *after* the hackathon. Do **not** prepare PRs or coordinate upstream now. App-specific
   policy/workflows stay **out** of the fork. License stays **MIT** with upstream attribution.
2. **browser-repos** — independent, open-source, Git-compatible browser library, reusable
   outside this product. Core is free of UI, LLM calls, and app logic.
3. **user-tailored-ui** — the reusable **skeleton**, shared customization, integration
   contracts, and the **main hackathon submission**. (This repo.)
4. **user-tailored-planner** — the task-planning app.
5. **user-tailored-inventory** — the inventory app.

`user-tailored-ui` consumes TailoredUI and browser-repos as **pinned** dependencies, hidden
behind interfaces. Pin integrated versions; document ownership and interfaces.

## Locked decisions (confirmed with PM)

- **Verification:** Sandbox is `INTEGRATIONS_ONLY` (no external network; `npm install`
  cannot reach the registry here). Real build/test verification runs in **GitHub Actions
  CI** (has network). Author + commit here; CI is the source of truth for "it runs."
- **License:** New repos (browser-repos, user-tailored-ui, -planner, -inventory) are
  **dual-licensed `MIT OR Apache-2.0`**. The TailoredUI fork stays **MIT** with upstream
  attribution (Aman Singh, 2023) preserved. Vendored third-party code keeps its own
  license + attribution (see NOTICE).
- **Inference providers:** **Ports & adapters (hexagonal)** pattern. Inference sits behind
  an `InferenceProvider` **port**; **Anthropic SDK** is the first adapter. OpenAI/Codex and
  others are added later without touching core or validation. The deterministic test double
  is just another adapter.
- **Credentials:** Support **both** BYOK (end-user supplies their own key, stored
  client-side only) **and** owner-managed subscription (owner's backend holds the key).
  Developers enable one or both. Secrets never live in browser code, repos, logs, commits,
  exports, or remote URLs. Configured with the PM outside the repos.
- **Budget:** No ceiling for now. **Gracefully handle quota/rate/failure** — surface the
  error, keep a recoverable valid view, fall back to the labeled test double in dev.
- **`.kiro` is public and never gitignored** (hackathon requirement — judges must see
  specs, steering, and development evidence in a fresh clone of this repo).

## Hard constraints (non-negotiable)

- **No arbitrary generated code executes in the host app.** The agent emits validated
  configuration / tokens / approved-component references only. Any code-editing or
  isolation surface must be discussed with the PM before being added.
- **User requests and model proposals are untrusted.** They cannot change or bypass
  policy, validators, or enforcement code. Validate **before every activation**, including
  resulting-view invariants. Explain rejections (citing the relevant rule) and retain a
  recoverable valid view.
- **Honesty:** Label test doubles and fallbacks. Document evidence, enforced scope,
  preferences, and limitations **without overstating reliability**. Distinguish **facts**
  from **assumptions**. Bring scope/cost/security/licensing decisions to the PM.

## Working agreement

- Spec-driven: requirements → design → tasks, iterated with the PM before large builds.
- Make **reversible** implementation choices where possible.
- First prove the **smallest end-to-end customization flow in ONE app (Planner)** —
  including a **rejected violation** and a recoverable valid view — before expanding.

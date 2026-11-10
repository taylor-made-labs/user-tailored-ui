# Requirements — user-tailored-ui (the product, forward spec)

Status: **forward spec** (written before the code it drives). Earlier specs
(`customization-foundation`, `planner-app`, `submission`) documented code after the fact.
This one comes first and drives the next builds.

Binding inputs: `.kiro/steering/*.md` (esp. `00-project.md`, `10-customization-boundary.md`,
`40-credentials.md`, `60-browser-repos.md`) and the five user answers recorded in the task
brief. Anything not stated there is marked **ASSUMPTION** and can be corrected.

## Introduction

user-tailored-ui lets an app's end-user change their own app by asking an in-app agent in
plain words. The agent proposes. A deterministic validator enforces the creator's rules.
Valid parts apply. Invalid parts are rejected with the rule named. The result survives
reload and can be undone. One shared foundation powers two different apps (Planner and
Inventory). That is the Skeleton Crew point.

## Glossary

- **Creator Policy / Creator Rules** — trusted, versioned rules owned by the app developer.
  Stored as a config file (R4).
- **Proposal** — untrusted, data-only change request from the agent (tokens, components,
  controls, actions). Never code.
- **Partial apply** — the valid parts of a proposal apply; each invalid part is rejected
  and named. (**ASSUMPTION A1:** today's orchestrator rejects a whole proposal; partial
  apply is new work, see tasks T2.)
- **BYOK** — bring your own key: the end-user supplies their own provider key.
- **Managed key** — the developer supplies the key; it lives only on a backend.
- **Broker** — a small backend that forwards inference calls (R3).
- **Test double** — deterministic labeled fake inference. CI only (R2.4).

## Status of what exists (facts, read from the code)

| Part | State |
|---|---|
| Foundation: types, validator, orchestrator, ports (`src/`) | Real, CI-tested |
| Creator policy | Real but **TypeScript objects** per app (`apps/*/src/customization/policy.ts`), not a config file |
| Tokens in policy | Only `fontScale`, `density` (+ `lowStockOnly` in Inventory). No color or layout tokens |
| History | Both apps use `browser-repos` (IndexedDB-git) from tarball at commit `369ab3d`, not `main` |
| Inference in the apps | `TestDoubleInferenceAdapter` only. Quick-pick buttons trigger it |
| Real inference adapter | `src/adapters/inference/agent-sdk.ts`: Claude Agent SDK via Claude Code CLI login. **Not usable in a browser.** Not wired into either app |
| BYOK / broker | Not built |
| TailoredUI fork | `taylor-made-labs/TailoredUI` exists. Not used by either app (see R6) |
| Real browser / extension run | **Never done.** Only jsdom + fake-indexeddb in CI |

## Requirements

### R1 — The scripted demo path (the product story)

**User story:** As a judge, I want one clear multi-turn story that shows a real agent, a
visible rejection, persistence, undo, and the same foundation in two apps.

**The path (both apps, in a real browser, real model):**

Planner:
1. Open the hosted Planner. Enter my own key (or use the developer's key if enabled).
2. Turn 1 — "Make this a calm focused daily agenda, bigger text." Agent proposes agenda
   component, `fontScale 1.4`, `density comfortable`. All valid. Applies. *(layout +
   component + tokens)*
3. Turn 2 — "Put the add-task box at the top and use a teal accent." Valid. Applies.
   *(control placement + color)*
4. Turn 3 — "Hide the complete buttons so it looks cleaner, and make the font 3x."
   Agent proposes both. The validator **rejects** removing `complete-task` (names rule
   `required-control: complete-task`) and **rejects** `fontScale 3` (names rule
   `token-range: fontScale 1..2`). The UI shows both reasons next to the proposal.
   **ASSUMPTION A2:** nothing from turn 3 applies because both parts are invalid; if the
   agent also proposed a valid part (e.g. "compact density"), only that part applies.
5. Turn 4 — "Same as turn 3 but keep the buttons, font 1.8." Valid. Applies.
6. Reload the page. The view from turn 4 is still there.
7. Undo twice. The view returns to turn 2. Tasks (business data) are untouched.

Inventory (same foundation, different rules):
8. Switch to Inventory. Enter the same key once (**ASSUMPTION A3:** key is per-origin, so
   re-entry is needed if the apps are on different origins; see R3.6).
9. Turn 1 — "Show only low-stock items as a list, bigger text." Valid. Applies.
10. Turn 2 — "Remove the adjust-quantity control." **Rejected** with
    `required-control: adjust-qty`.
11. Reload: kept. Undo: reverts. Stock numbers unchanged.

**Acceptance (EARS):**
- WHEN a person follows the path above THEN each step SHALL produce the stated outcome.
- The path SHALL be written as a runnable script in the repo (`docs/DEMO.md`) and as an
  automated browser test against a real model (gated, R7.3).
- The UI SHALL show, for each turn: the agent's proposal, per-part verdict (applied or
  rejected), and for each rejection the rule id and a plain sentence.
- The same foundation package SHALL serve both apps with no per-app fork of validator
  or orchestrator code.

### R2 — Inference is real; the test double is CI-only

**User story:** As a judge, I must never be shown a fake agent.

**Acceptance (EARS):**
- R2.1 The product and the hosted demo SHALL use a real model adapter. No quick-pick
  buttons that call a fake agent SHALL ship in the product UI.
- R2.2 The first real adapter SHALL use the Anthropic Messages API (`@anthropic-ai/sdk`)
  behind the existing `InferenceProvider` port. (The Agent SDK adapter stays as a dev-only
  adapter; it cannot run in a browser.)
- R2.3 The adapter SHALL request structured output (a JSON proposal) and SHALL parse it
  as data. WHEN the response is not valid JSON or not the proposal shape THEN the system
  SHALL return `InferenceError('invalid-response')` and keep the current view.
- R2.4 The test double SHALL be selectable only in tests and in a dev build flag
  (`VITE_INFERENCE=test-double`). It SHALL be absent from the production bundle
  (**checked by a bundle grep in CI**) and every result from it SHALL be labeled
  `SIMULATED`.
- R2.5 WHEN no key is available THEN the UI SHALL say so and block asking. It SHALL NOT
  fall back to the test double in production.
- R2.6 WHEN the provider fails (auth, quota, rate limit, network) THEN the UI SHALL show
  the typed error, keep the last valid view, and allow retry.

### R3 — Keys: BYOK, managed, or both, chosen per app

**User story:** As an app developer, I choose how my app gets a key. As an end-user, my
key stays mine.

**Findings from the Anthropic docs (checked):** The TypeScript SDK refuses to run in a
browser unless `dangerouslyAllowBrowser: true` is set
([SDK docs](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)). The
API allows browser CORS calls only when the request carries the header
`anthropic-dangerous-direct-browser-access: true`
([Simon Willison, Aug 2024](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access)).
Both names are warnings: any key in a page is visible in dev tools. So direct browser
calls are safe only for a key the end-user typed themselves. A developer's key must
never be in browser code. (Content rephrased from those sources.)

**Acceptance (EARS):**
- R3.1 Each app SHALL declare in its config `inference.keyModes`: any non-empty subset of
  `["byok","managed"]`. The UI SHALL show only the enabled modes.
- R3.2 **Managed mode.** The browser SHALL call a broker URL with no key. The broker SHALL
  read the key from a server environment variable and forward to Anthropic. The key SHALL
  NOT appear in the bundle, source maps, repo, logs, or responses. (CI: grep the built
  `dist/` for `sk-ant-` and for the env var name's value pattern.)
- R3.3 **BYOK storage.** The user's key SHALL be held in memory for the session by
  default. WHEN the user ticks "remember on this device" THEN it SHALL be stored in
  IndexedDB under a store named `secrets`, separate from the `browser-repos` database.
  **ASSUMPTION A4:** IndexedDB (not `localStorage`, per steering 60) and stored as
  plain text in the user's own browser; WebCrypto wrapping with a non-extractable key is a
  later hardening task (T3.6).
- R3.4 The key SHALL NOT be written to customization history, exports, logs, URLs, or
  error messages. A test SHALL put a canary key in and assert it appears in none of
  these.
- R3.5 **BYOK routing.** Default: browser → broker pass-through (key sent in a request
  header, broker forwards and stores nothing, no logging of headers). Opt-in per app:
  `inference.byokRoute: "direct"` sends browser → `api.anthropic.com` with the
  browser-access header; the UI SHALL label this "key goes straight from your browser to
  Anthropic". (Matches steering 40.) **ASSUMPTION A5:** the pass-through default is kept
  even though direct is simpler for the hosted demo; the demo app may set `direct`.
- R3.6 WHEN both modes are enabled THEN the user SHALL pick one; managed is used if the
  user enters no key. **ASSUMPTION A6:** both apps share one broker and one origin path
  prefix (`/planner`, `/inventory`) so the key store can be shared; if hosted on
  separate origins the key is entered per origin.
- R3.7 The broker SHALL allow only the `messages` endpoint, a pinned model allow-list,
  and a max token cap, and SHALL rate limit per IP. **ASSUMPTION A7:** limits are
  placeholders until the user sets a budget (steering: no ceiling for now).
- R3.8 Setting the developer key SHALL be done by the human on the deploy target. The
  agent SHALL NOT handle credentials.

### R4 — Creator rules: a config file with a versioned schema

**User story:** As a creator (or an AI agent acting for one), I edit one file to change my
app's rules.

**Acceptance (EARS):**
- R4.1 Each app SHALL keep its creator rules in `creator-policy.json` (replacing the TS
  policy objects). **ASSUMPTION A8:** JSON (not YAML/TOML) because the browser parses it
  with no dependency and JSON Schema tooling is standard.
- R4.2 The file SHALL carry `"$schema"` and `"schemaVersion"` (semver). The schema lives
  in the foundation at `schemas/creator-policy.v1.schema.json` (JSON Schema 2020-12).
- R4.3 The schema SHALL cover: `policyVersion`, `allowedActions`, `requiredControls`,
  `allowedComponents`, `tokens` (number range, enum, boolean, color-with-contrast-floor),
  `layout` slots, and `inference` (R3).
- R4.4 WHEN the file fails the schema THEN loading SHALL fail closed with errors that
  give the JSON path, the rule, the bad value, and a fix hint (for example
  `/tokens/fontScale/min: expected number, got "one". Use a number such as 1.`).
- R4.5 Every field in the schema SHALL have a `description` and an `examples` entry so an
  AI agent can read the schema and edit the file correctly. The schema SHALL use
  `additionalProperties: false` so typos are caught.
- R4.6 A CLI `npm run policy:check -- <file>` SHALL validate a file and print the errors.
  CI SHALL run it for both apps.
- R4.7 WHEN a saved customization was made under an older `policyVersion` THEN reopen
  SHALL revalidate it under the current policy; incompatible parts are dropped and the
  user is told which (steering 10).
- R4.8 Schema changes SHALL bump `schemaVersion`; the loader SHALL support the current
  and previous major, with a migration function and a test.
- R4.9 A visual creator editor SHALL be built later **on the same schema** (tasks, phase
  5). It SHALL NOT introduce a second format.
- R4.10 User requests and proposals SHALL NOT be able to write the policy file or any
  policy-reserved key (existing tamper guard stays).

### R5 — Richer customization than colors

**Acceptance (EARS):**
- R5.1 The token set SHALL include: `accent` (color, creator gives allowed palette or a
  min contrast ratio against background), `fontScale`, `density`, plus per-app tokens.
  **ASSUMPTION A9:** contrast floor 4.5:1 (WCAG AA body text) as the shipped default.
- R5.2 Layout SHALL be expressed as named slots (for example `main`, `sidebar`, `top`)
  each holding an ordered list of allowed component ids. Proposals may reorder and move
  components between slots the policy allows.
- R5.3 Controls SHALL be movable between slots and may be hidden only if not in
  `requiredControls`.
- R5.4 The validator SHALL check the resulting view, not only the proposal: required
  controls present and reachable, contrast floor holds, only allowed components shown.
- R5.5 Each rejection SHALL carry `{ruleId, path, message}` where `ruleId` matches an id
  in the policy file.

### R6 — TailoredUI fork: dependency and fork rule

**Facts found (checked on GitHub):** the fork is
[taylor-made-labs/TailoredUI](https://github.com/taylor-made-labs/TailoredUI), forked from
`TailoredUI/TailoredUI` (React + Vite + Tailwind live theme editor, MIT, Aman Singh 2023).
Its `main` has **0 commits ahead** of upstream today. It has branches `aman`, `develop`,
`dummy`, `fixes`; `fixes` is 0 ahead and 4 behind `main`, `develop` is 29 ahead of `main`
(**not investigated; ASSUMPTION A10:** these are upstream contributor branches, not
our work). The fork is not on disk under `/home/agents/dev`. Neither app imports it; each
app ships its own in-repo `UiCapability` adapter. So **today we have fixed or added
nothing in the fork**, and the README already says the fork is not on the demo path.

**Acceptance (EARS):**
- R6.1 The spec SHALL name the TailoredUI parts the product depends on. **ASSUMPTION
  A11 (to confirm after reading the fork source in T4.1):** the Tailwind theme/token
  editing model and the pre-built component library, consumed as data (token names,
  component descriptors), not as live editor UI.
- R6.2 WHEN the product needs a change in TailoredUI THEN we SHALL make it in our fork
  (`taylor-made-labs/TailoredUI`) on a feature branch, with one concern per commit and a
  message that says what and why. We SHALL NOT wait on upstream. Upstream PRs come after
  the hackathon.
- R6.3 The product SHALL pin the fork by commit SHA and consume it as a package or
  tarball (same method as `browser-repos`, T1.1), behind the `UiCapability` port.
- R6.4 No app policy, workflow, or secret SHALL be committed to the fork. License stays
  MIT with upstream attribution.
- R6.5 The README SHALL list each fork commit the product depends on, so the claim "we
  use TailoredUI" can be checked.
- R6.6 IF T4.1 finds the fork cannot supply a usable capability within the deadline THEN
  the README SHALL say so plainly and the port adapter stays in-repo. (Honesty, steering
  00.)

### R7 — Verified in a real place

**Acceptance (EARS):**
- R7.1 Both apps SHALL be built and served as static sites and tested in real Chromium
  (Playwright) in CI: reload persistence, undo, IndexedDB-git in a real IndexedDB.
- R7.2 The packaging check (`npm pack`/tarball install, build, bundle grep) SHALL run on
  Linux, macOS and Windows runners.
- R7.3 A gated, manual CI job SHALL run the R1 path against the real model with the
  `ANTHROPIC_API_KEY` secret. Not run on fork PRs (steering 40).
- R7.4 **ASSUMPTION A12:** a browser extension (MV3) build is *not* required for the
  hackathon; steering 60 requires MV3-safe code (no CDN, no eval) and the check is a
  manifest-lint + CSP test, not a published extension. Correct me if an extension is
  expected.

### R8 — Definition of done: the person checks it

A person, in a real browser, with a real key, must be able to do all of these. The work
is not done until each passes.

1. Open the **hosted** Planner URL. The page loads, shows no `SIMULATED` label and no
   quick-pick fake-agent buttons.
2. Enter **my own key**. Ask "make this a calm daily agenda with bigger text". The view
   changes and the proposal shows each part marked applied.
3. Ask "hide the complete buttons and make the font 3x". **One or more parts are
   rejected, each with the rule name and a sentence.** The view stays valid.
4. **Reload** the tab. My earlier changes are still there; my key is gone unless I chose
   "remember on this device".
5. Press **Undo**. The view goes back one step; my tasks are unchanged.
6. **Switch to Inventory**, ask for "only low-stock items, as a list". It works. Remove
   the adjust-quantity control: rejected with the rule name.
7. In dev tools, **search the loaded JavaScript** for my key and for `sk-ant-`: nothing
   found in any file, and the key is absent from the exported history.
8. Edit `creator-policy.json` (for example `fontScale.max` to 1.5), rebuild, repeat step
   3: the rejection now cites 1.5. Introduce a typo in the file: the build fails with a
   clear error naming the path.

### Out of scope (this spec)
- General policy framework; model alignment research (steering 10).
- User code editing or custom component authoring (needs PM sign-off).
- Upstream TailoredUI PRs; a published extension (A12).
- OpenAI/other providers (port stays open; not built now).

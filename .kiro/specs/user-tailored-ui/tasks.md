# Tasks — user-tailored-ui (forward spec)

Legend: **[H]** needs a human. **[AWS]** needs AWS access (not connected today).
**[P]** can run in parallel with others in the same phase. Each task lists its own
acceptance check. Every guess is marked **ASSUMPTION**. Tasks touching `.github/workflows/`
must run one at a time (workflow-file contention).

Requirement ids refer to `requirements.md`.

## Phase 1 — Fix known defects (unblocks everything) 

- [x] **T1.1 [P] Rebuild the browser-repos tarball from `main`.** Replace the
  `369ab3d` tarball in both apps with one built from browser-repos `main`; record the SHA
  in each app README and the lockfile integrity hash.
  _Check:_ CI green; `npm ls @taylor-made-labs/browser-repos` shows the new build; a test
  imports a slice 6/7 export that the old build lacks. _(R7)_
  _Done:_ tarball built from browser-repos `6fd649f` via new `scripts/pack-browser-repos.sh`;
  integrity updated in both lockfiles; `npm ci` accepts it; `test/browser-repos-pin.test.ts`
  imports `GitHubSyncTarget`. Both apps: typecheck, lint, test (26 / 28), build pass on Node 24 locally.
  Defect found: the old tarball's `package.json` was hand-written; the script now generates it.
- [x] **T1.2 [P] Make `scripts/vendor-apps.sh` safe.** It must not delete app-owned wiring
  (`src/adapters/history-browser-repos.ts`, `vendor/`, `creator-policy.json`). Preferred:
  explicit keep-list; later option is the workspace package (design §5, A17).
  _Check:_ run the script on a clean clone; `git diff` shows no deletion of wiring files;
  CI `apps` job still green. _(R7)_
  _Done:_ script no longer runs `rm -rf`; rsync has no `--delete` and a `KEEP_LIST` of app-owned
  files. Ran it on a fresh worktree of main: `git status` shows only the script changed, no
  file removed. First draft of the list missed `vitest.config.ts` (drops `setupFiles`) and
  `src/customization/service.ts` (reverts a comment); both added after the diff showed them.
  Limit: `package.json` is kept, so upstream dependency changes need a manual merge.
- [ ] **T1.3 [P] Cross-OS packaging check.** Extend the pack/install/build check to
  `ubuntu`, `macos`, `windows` runners. **ASSUMPTION A18:** Node 20 on all three.
  _Check:_ CI matrix shows 3 green jobs. _(R7.2)_
- [ ] **T1.4 Hoist the duplicated history adapter into the foundation.** One
  `BrowserReposHistory`; both apps import it.
  _Check:_ grep finds one implementation; both apps' history tests pass. _(R1, design §5)_

## Phase 2 — Creator rules as a config file (foundation)

- [ ] **T2.1 [P] JSON Schema `creator-policy.v1`.** Fields per R4.3, descriptions and
  examples on all, `additionalProperties:false`.
  _Check:_ valid and invalid fixture per field; schema itself validates under Ajv strict. _(R4.2–R4.5)_
- [ ] **T2.2 `JsonPolicySource` + error rewriter.** Load, validate, map to `CreatorPolicy`.
  _Check:_ table test of 10 bad files, each yields path + rule + hint; good file maps to
  the policy equal to today's TS policy. _(R4.4)_
- [ ] **T2.3 `policy:check` CLI + CI step.**
  _Check:_ exits non-zero on a bad file with readable output; CI runs it on both apps. _(R4.6)_
- [ ] **T2.4 Convert Planner and Inventory policies to `creator-policy.json`.** Delete the
  TS policy objects.
  _Check:_ existing customization tests pass unchanged against the JSON policy. _(R4.1)_
- [ ] **T2.5 [P] Partial apply in validator + orchestrator** (A1). Parts, per-part verdicts,
  fixpoint on resulting-view invariants, tamper = whole reject.
  _Check:_ property-style tests: output never violates policy; mixed proposal applies
  valid part and rejects invalid part with `ruleId`; one passing + one violating test per
  invariant. _(R1, R5.5)_
- [ ] **T2.6 [P] Layout slots, movable controls, `accent` color with contrast floor.**
  _Check:_ violating tests: low-contrast accent, component in a disallowed slot, hiding a
  required control. _(R5)_
- [ ] **T2.7 Policy versioning + migration + revalidate-on-reopen.**
  _Check:_ saved state under old `policyVersion` reopens with incompatible parts dropped and
  reported. _(R4.7, R4.8)_

## Phase 3 — Real inference and keys

- [ ] **T3.1 [P] `AnthropicMessagesAdapter`** with strict proposal parsing and error mapping.
  _Check:_ mocked-fetch tests for success, bad JSON, wrong shape, 401, 429, network. _(R2.2, R2.3, R2.6)_
- [ ] **T3.2 [P] `KeyStore` (session + IndexedDB) and `SecretString`.**
  _Check:_ canary-key test: key absent from history, export, logs, error text. _(R3.3, R3.4)_
- [x] **T3.3 [P] Broker.** Stateless function, routes and checks per design §4.3. Local
  runnable with `node`; deployable to Lambda.
  _Check:_ tests: managed adds server key; BYOK passes through and never logs; bad origin,
  bad model, oversize body all refused. _(R3.2, R3.5, R3.7)_
  _Evidence:_ `src/broker/{handler,lambda,server}.ts`; `test/broker.test.ts` (9 tests: managed key,
  BYOK pass-through, canary key absent from logs/errors/responses, refusals, rate limit).
  Overlap: no `SecretString` yet (PR #18); keys are call-local strings, swap in later.
  Not done: AWS hosting (T4.6); rate limit is in-memory per instance.
- [ ] **T3.4 App UI for keys.** Mode picker from `inference.keyModes`, key field, "remember
  on this device", route label for direct mode, clear error states.
  _Check:_ component tests; with no key, Ask is disabled with a message. _(R2.5, R3.1)_
- [ ] **T3.5 Remove fake-agent quick picks from product UI; gate the test double.**
  _Check:_ production build grep finds no test-double code and no `SIMULATED` path;
  dev flag still shows labeled `SIMULATED`. _(R2.1, R2.4)_
- [ ] **T3.6 [P] Key hardening (later).** WebCrypto wrapping, non-extractable key.
  _Check:_ stored value is not the plain key. _(A4)_
- [ ] **T3.7 Proposal/verdict UI.** Show proposal, per-part verdict, rule id and sentence.
  _Check:_ component test renders a mixed result; copy matches R1. _(R1)_

## Phase 4 — Real browser, TailoredUI, deploy

- [x] **T4.1 [P] TailoredUI spike.** _Done 2026-11-10: NO-GO as runtime dependency; bounded GO option sized at 4 to 5 days. `develop` confirmed as upstream's branch (29 ahead, all upstream authors). See `docs/TAILOREDUI.md`._ Clone the fork; read it; write `docs/TAILOREDUI.md`
  listing what we depend on, what we changed (today: nothing), what we need. Decide go /
  no-go (A11, R6.6).
  _Check:_ doc exists with commit SHAs; README fork section updated either way. _(R6)_
- [ ] **T4.2 Deferred (T4.1 verdict: NO-GO as is; optional bounded change, about 4 to 5 days, do after T2/T3/T4.3). If go: fork changes + `TailoredUiAdapter`.** Work in the fork on `utui/*`
  branches, clean commits, pinned by SHA, listed in README.
  _Check:_ the app renders at least one component through the fork in a Playwright run;
  fork `git log` shows only our scoped commits. _(R6.2–R6.5)_
- [x] **T4.3 Playwright suite on both apps** (reload persistence, undo, rejection UI) with
  a stub broker, in real Chromium.
  _Check:_ CI job green; trace artifacts uploaded. _(R7.1)_
  _Evidence (partial, honest):_ `e2e/` suite runs both built apps via `vite preview` in real
  Chromium (`cd e2e && npm ci && npx playwright test`): 12 pass, 2 `fixme` (T3.7), 0 unexpected
  failures. Inference is the labeled test double (no key here); no product path added.
  **Not yet met:** CI job + trace upload (workflow edit is sensitive; separate PR).
  **Real defects found by this suite, now FIXED (D1-D3), with the e2e tests un-skipped:**
  - **D1 (fixed):** `Buffer is not defined` on Apply. Root cause: isomorphic-git reads a
    global `Buffer`. Fixed in the library (browser-repos PR #10): `src/buffer-polyfill.ts`
    installs the pinned `buffer@6.0.3` when the host has none. Unit test
    `test/browser-env.test.ts` runs a commit with no Buffer global. No app-side polyfill.
    Both apps re-vendor the tarball built from browser-repos `bda680b`.
  - **D2 (fixed):** LightningFS saves its index on a ~500ms debounce. browser-repos now
    flushes to IndexedDB before any mutation (and repo creation) resolves, so Apply is
    durable when it reports success. Unit test: a fresh `RepoManager` opened right after
    `commit()` sees it. e2e "reload right after Apply keeps the change" passes, no wait.
  - **D3 (fixed):** history now ends with a "reset to default view" action in both apps. It
    saves the shipped baseline as a new history entry, so reload keeps it. e2e covers it.
  - Evidence: `cd e2e && npx playwright test` in Chromium: 12 pass, 2 skipped (T3.7 only),
    0 `test.fail`, 0 Buffer shim. Overlap note: PR #20 (shared history adapter) moves the history adapters; this change leaves them
    alone (D2 is fixed in the library), so no conflict is expected.
  - T3.7 per-part verdict UI is absent; rejection shows rule id + message only (tested).
  - The default product agent is still the test double (T3.5).
- [ ] **T4.4 Durability evidence for IndexedDB-git.** Reload mid-write and kill-tab test;
  record results in `docs/DURABILITY.md`.
  _Check:_ doc has results and any limits stated plainly. _(steering 60)_
- [ ] **T4.5 MV3-safety check.** Manifest lint + CSP test on built output (no CDN, no
  eval). Extension build itself is out of scope (A12). **ASSUMPTION A12.**
  _Check:_ CI step green. _(R7.4)_
- [ ] **T4.6 [H] [AWS] Hosting + broker deploy.** Human connects AWS and sets the
  `ANTHROPIC_API_KEY` env var on the broker. Agent supplies IaC/scripts (**ASSUMPTION
  A16**: Lambda function URL + S3/CloudFront static hosting, one origin with `/planner`
  and `/inventory`).
  _Check:_ both apps load from the hosted URL; broker returns a real proposal. _(R3.2, R8.1)_
- [ ] **T4.7 [H] Gated live CI job.** Human adds `ANTHROPIC_API_KEY` as a GitHub secret.
  Workflow `live-demo.yml`, manual trigger only, not on fork PRs.
  _Check:_ a manual run passes the R1 path against the real model. _(R7.3)_
- [ ] **T4.8 `docs/DEMO.md` + demo script.** The R1 path, step by step, with expected
  outcome per step.
  _Check:_ a person can follow it cold; matches R1 line by line. _(R1)_

## Phase 5 — Creator editor (later)

- [ ] **T5.1 Schema-driven creator editor UI** on the same JSON Schema (A14). Reads and
  writes `creator-policy.json`; shows the same error messages.
  _Check:_ edit in UI → file diff is minimal and passes `policy:check`; no second format. _(R4.9)_
- [ ] **T5.2 Editor is creator-only.** Not reachable from the end-user agent panel; the
  agent cannot call it.
  _Check:_ test: proposal touching policy keys is still rejected. _(R4.10)_

## Phase 6 — Done check

- [ ] **T6.1 [H] The person checks it.** A person runs the 8 checks in R8 in a real
  browser on the hosted app with their own key.
  _Check:_ all 8 pass, results recorded in `docs/ACCEPTANCE.md`. _(R8)_

## Order and parallelism

- Start together: T1.1, T1.2, T1.3, T2.1, T3.1, T3.2, T3.3, T4.1 (all independent).
  T1.3 touches workflows, so run it alone among workflow-editing tasks.
- Then: T1.4, T2.2→T2.3→T2.4, T2.5, T2.6, T3.4, T3.5, T3.7.
- Then: T2.7, T4.2 (if go), T4.3, T4.4, T4.5, T4.8.
- Human gates (batch these early so they clear while away): **T4.6, T4.7**, plus the
  budget decision for A7.

## Assumptions index (correct any)

A1 partial apply is wanted · A2 turn-3 outcome · A3 key re-entry across origins · A4 plain
IndexedDB key store first · A5 pass-through default, demo may use direct · A6 shared
origin · A7 broker limits are placeholders · A8 JSON format · A9 4.5:1 contrast · A10
fork branches are upstream's · A11 what we use from TailoredUI · A12 no extension build
needed · A13 lossless policy mapping · A14 rjsf for editor · A15 Haiku-class model · A16
AWS Lambda + CloudFront · A17 workspace package later · A18 Node 20 on all OSes.

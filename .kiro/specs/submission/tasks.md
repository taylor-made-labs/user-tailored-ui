# Tasks — Submission Gap Audit (brutally honest, ranked by impact)

Status: **audit as of 2026-11-09, from reading real code, tests, and PR state** — not
READMEs. **Updated 2026-11-09 (closeout PR):** headline gaps 1–3 are closed; the entries
below carry evidence. Each repo is graded against the `requirements.md` bars. The distinction everywhere
is **tracer-bullet done** (builds + CI green) vs. **product-ready done** (the claimed thing
is present, wired, reachable by a judge, and tested with depth).

Grades: ✅ **done** · 🟡 **shallow / partial** · ❌ **missing** · ⚠ **overstatement risk**.

---

## Headline gaps (the five that move the submission bar)

1. **✅ CLOSED (PRs #11, #12). Was: storage story not wired.** The submission's distinctive claim —
   customization history on IndexedDB-backed Git (`browser-repos`) — is **not connected**.
   `user-tailored-ui/package.json` declares **no** browser-repos dependency; both apps
   default to the **in-memory** history double. The `CustomizationHistoryStore` port exists,
   but no adapter over browser-repos is wired at any composition root. A judge cannot see
   IndexedDB-git persistence happen.
2. **✅ CLOSED. Was: browser-repos mostly unmerged.** All slices (#2–#8) are on `main` (`98fb9ad`, verified in a fresh clone: 121 tests pass, 1 live-network test skipped by design). Original text: `main` = seed + Slice 1 (repo lifecycle). Slices
   2–7 (git ops, branches, export/import, durability, public API, remote sync) are
   **CI-green but OPEN, stacked** PRs #3–#8 on feature-branch bases. A fresh clone of
   `browser-repos` `main` gets a near-empty library.
3. **✅ CLOSED. Was: standalone planner `main` is a stub.** PR #2 is merged (`6143130`). Original text: The real planner slice is
   **open PR #2**; `main` renders `user-tailored-planner (seed)`. README is honest about it,
   but the source of record for App #1 is unmerged.
4. **❌ No hosted demo URLs and ❌ no <3-min YouTube demo.** The entire presentation
   dimension (R0.7 / R3 / R6) is unmet. High judge-facing impact, low effort.
5. **⚠ Rubric unverified (A1).** The official rules page 403s to automated fetch; the rubric
   here is best-practice. A human must reconcile it before submit (T0).

---

## T0 — Pre-submission human gates (block submit, not build)

- [ ] **T0.1 ⚠ Verify the official rubric.** A human opens
      [kiroween.devpost.com/rules](https://kiroween.devpost.com/rules), reconciles every R0
      dimension and A3 date against it, and corrects this triad. **Only a human can clear
      this** (the page 403s here).
- [ ] **T0.2** Confirm the submission category is **Skeleton Crew** on Devpost.
- [ ] **T0.3** Confirm demo-URL + judge-access requirements and the Jan 29 2027 access window.

---

## T1 — `user-tailored-ui` (submission repo) — mostly product-ready

Default branch `main`; `verify` + `app (planner)` + `app (inventory)` green on fresh clone.

- ✅ Enforcement core (policy/validator/orchestrator) real on `main`; invariant pass+fail
  tests; tampering + prototype-pollution guards.
- ✅ Both apps vendored and runnable, each with its own green CI matrix job.
- ✅ Test-double inference adapter, labeled `simulated:true`.
- ✅ Claude Agent SDK adapter present (real code), correctly optional/keyless-by-default.
- ✅ Public `.kiro/` with foundation + planner triads, steering, reviewer agent; this
  submission spec now added.
- [x] **T1.1 ✅ DONE (PRs #11 planner, #12 inventory; both on `main`).** Evidence: `apps/*/src/adapters/history-browser-repos.ts`, `apps/*/src/main.tsx`, `apps/*/test/history-persistence.test.ts`. Caveat: the reload is simulated with fake-indexeddb under Node. Original: Wire the browser-repos history adapter in at least ONE app** (see T4.1) — or,
      if deferred, **T1.2**.
- [x] **T1.2 N/A, storage is wired.** README now has a real-vs-stubbed table. Original: If storage stays in-memory, restate the claim.** Update README + design so
      "IndexedDB-backed Git customization history" reads as *intended architecture*, not
      current runtime behavior. Do not ship the stronger claim unwired.
- [x] **T1.3 ✅ DONE.** Evidence: [`docs/fresh-clone-check.md`](../../../docs/fresh-clone-check.md). Fresh clone, README commands run as written: root and both apps pass (Node 24; planner also Node 20). **Defect found and fixed:** README said `dev` at the root, which has no such script. **Not verified:** the Vite dev server was never launched (sandbox blocks servers); open it once by hand. Original: Fresh-clone run doc. Verify on a clean machine that the README commands
      build and start both apps with no workspace state; fix any gap. (CI proves build, not
      the human run-through.)
- [x] **T1.4 ✅ DONE.** README "What is real vs. stubbed" says plainly: each app uses its own in-repo `TailoredUiCapabilityAdapter` and does not import the fork (grep of `apps/*/src` and `src/` finds no fork import). NOTICE updated. **Finding:** the fork contributes nothing to the running demo. Original: TailoredUI fork honesty. README should state plainly that the demo path
      uses the in-repo `UiCapability` adapter, and what (if anything) the fork contributes,
      so the fork's role is not overstated.

## T2 — `browser-repos` — built but unmerged; spec/code mismatch

- ✅ Slice 1 (repo lifecycle on LightningFS + IndexedDB) merged on `main` (PR #2).
- 🟡 Slices 2–7 are substantial (≈680–2300 added lines each) and `verify`-green, but **OPEN**
  and **stacked** (#3→#4→…→#8 on feature-branch bases), so none is on `main`.
- [x] **T2.1 ✅ DONE.** All 7 slices on `main`. Original: Land the library on `main`.** Rebase the stack into a clean `#3→#8` order and
      merge in sequence (known tangled-base issue). Non-sensitive → auto-merge on green,
      per the gate. **Biggest depth win for R2.2.**
- [x] **T2.2 ✅ DONE (browser-repos PR, see its `.kiro/specs/`).** `specs/README.md` no longer says "seed"; it records what shipped per slice with test evidence. Full triads were not written; the record is retroactive and says so. Original: Fix the spec/code mismatch. `browser-repos/.kiro/specs/README.md` says "no
      capability specs have been written yet — this repo is a seed," yet 7 slices of code
      exist in PRs. Write the real triads (or at least record what shipped) so the `.kiro/`
      evidence matches the code a judge reads.
- [x] **T2.3 🟡 PARTIAL, stated honestly (browser-repos PR, `docs/mv3-compat.md`).** A new test scans the shipped `dist/` for `eval`, `new Function`, `importScripts`, remote imports/URLs, `localStorage`, `chrome.storage`, and runs a git round-trip in a Node `vm` context with no `window`/`document`. **Not proven:** a real MV3 extension in Chrome (needs a browser and a human). Original: MV3 proof. Demonstrate (test or doc) the library actually runs in an MV3
      service-worker context (no CDN, no `eval`, IndexedDB only) rather than only asserting it.

## T3 — `user-tailored-planner` (standalone) — stub on main

- 🟡 README honestly labels `main` a seed and explains no published-dep is declared yet.
- 🟡 Real planner slice is **open PR #2**, CI-green, mergeable.
- [x] **T3.1 ✅ DONE.** PR #2 merged (`6143130`); apps/planner pin tree equals that `main`. Original: Merge PR #2 (or add a prominent README pointer that the runnable Planner is
      `user-tailored-ui/apps/planner`). Low effort; removes the "App #1 source is empty"
      smell. The vendored copy already carries the demo, so this is honesty, not blocker.

## T4 — Cross-repo integration — the real-vs-claimed seam

- [x] **T4.1 ✅ DONE (PRs #11, #12).** See T1.1. Original: Connect customization history to browser-repos in an app** (pairs with T1.1).
      Add a `CustomizationHistoryStore` adapter backed by browser-repos, wire it at one app's
      composition root (keep the in-memory double for tests), and show save/reopen/undo
      persisting through IndexedDB-git across reload. **This is the single highest-impact
      product-ready task** — it turns the headline architecture diagram into something a
      judge can watch happen.
- [x] **T4.2 ✅ DONE, with two real defects recorded.** `apps/*/README.md` now record source commit, local changes, and the `browser-repos` tarball provenance. **Defect A (unresolved):** the tarball `dist/` is byte-identical to browser-repos at `369ab3d` (slice 5), not `main` `98fb9ad`; the apps lack slices 6–7 until the tarball is rebuilt. **Defect B (unresolved):** `scripts/vendor-apps.sh` does `rm -rf apps/<app>` and re-copies from the source repos, so re-running it **deletes the browser-repos wiring** from #11/#12; the READMEs warn. Original: Pin + record vendored source commits. Confirm `apps/*/README` records the
      exact source commit and the one-command reproduce path, and that the pin is current.

## T5 — Presentation & packaging (R3 / R6) — currently unmet

- [ ] **T5.1 ❌ Hosted demo URLs.** Deploy both apps as static sites (offline-first on the
      test-double) and publish URLs that stay live through Jan 29 2027.
- [ ] **T5.2 ❌ <3-min YouTube demo** walking the R1 path (workflow → customize → rejection →
      save/reopen/undo → second app). Highest ratio of judge impact to effort.
- [x] **T5.3 ✅ DRAFT DONE.** [`docs/SUBMISSION-DRAFT.md`](../../../docs/SUBMISSION-DRAFT.md): credits Kiro and Kiroween 2026, discloses isomorphic-git, LightningFS, TailoredUI (not on demo path), Claude Agent SDK, AI use. Placeholders remain for URLs, video, screenshots. Original: Submission write-up crediting Kiro + Kiroween 2026; disclose reused upstream
      (TailoredUI fork, isomorphic-git, LightningFS) in NOTICE + the write-up.
- [x] **T5.4 🟡 DONE on Linux only.** See `docs/fresh-clone-check.md`: no tracked secrets or build output, secret-pattern scan clean, licenses present, tarball resolves from the lockfile. Not covered: Windows, macOS. Stale per-app `NOTICE` files say "seed scaffold" (root NOTICE is accurate). Original: Clean-machine packaging check before submit (R6).
- [ ] **T5.5 (bonus) 🟡 DEV blog draft**, human-reviewed, AI-writing disclosed, published
      in-window.

---

## What is genuinely done (so effort goes to gaps, not re-proving these)

- The **core idea works end-to-end offline**: natural-language request → proposal →
  deterministic validation → preview/apply/save/reopen/undo, plus the **rejection beat** with
  a cited rule and a recoverable view — in **both** apps, tested per invariant class.
- **Two genuinely distinct apps** share one enforcement core (dogfooding, not copying).
- **CI/CD gate** is a real, keyless, deterministic floor with honest optional model layers.
- **Honesty discipline** is already strong in prose (test-double labeling, "planned"
  markers). The gaps are in **wiring and presentation**, not in truthfulness of the docs.

## Suggested order (impact-first)

1. T5.2 video + T5.1 demo URLs (presentation; cheap, high judge impact).
2. T4.1/T1.1 wire browser-repos storage into one app (closes the biggest real-vs-claimed gap).
3. T2.1 land browser-repos slices on `main`; T2.2 fix its spec/code mismatch.
4. T3.1 merge planner PR #2 (or README pointer).
5. T1.2 restate the storage claim if T4.1 is deferred — never ship the unwired claim.
6. T0 human rubric reconciliation before the Dec 4 submit.

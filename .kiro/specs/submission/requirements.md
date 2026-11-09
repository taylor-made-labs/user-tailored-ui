# Requirements — Kiroween 2026 Submission (whole-entry acceptance)

Status: **authoritative acceptance spec.** This is the missing top-level spec. It defines
what "submission-ready done" means for the entire Skeleton Crew entry — the four repos as
one submission — and the acceptance bar each repo must clear. The per-spec triads
(`customization-foundation`, `planner-app`) describe pieces; this describes the whole and
the judge's experience.

It supersedes nothing; it sits above the existing specs and the living compliance checklist
(`.kiro/steering/90-hackathon-compliance.md`), turning them into measurable acceptance
criteria. Where the two disagree, the dated rules page wins — see A1.

## Assumptions (facts vs. assumptions — honesty invariant)

- **A1 — Rubric source.** The official Kiroween 2026 rules page
  ([kiroween.devpost.com/rules](https://kiroween.devpost.com/rules)) returns **403 to
  automated fetch** from this environment, so the exact weighted judging rubric could not be
  read in-repo or online here. The rubric below is a **best-practice reconstruction** from
  the PM brief and the committed compliance checklist, using the categories hackathon judges
  conventionally score (technical execution, Kiro usage, originality, completeness,
  presentation). **Before submission, a human MUST open the rules page and reconcile every
  item here against it** — this is a required pre-submit task (see `tasks.md` T0).
- **A2 — Category.** The entry targets the **Skeleton Crew** category: a lean, flexible
  reusable template demonstrated by **two distinct apps**. Confirmed by the PM brief and
  steering `00-project.md`.
- **A3 — Dates.** Submission window ≈ **Oct 30 – Dec 4, 2026**; submission closes
  **Dec 4, 2026, 2:00 PM PST**; free judge access through **Jan 29, 2027**. Treat as
  assumed until A1's human check confirms them.

## Glossary (used throughout the triad)

- **Submission repo** — `user-tailored-ui`. The one repo a judge clones. Holds the skeleton,
  the shared customization logic, and **vendored runnable copies** of both apps.
- **Tracer-bullet done** — it builds and CI is green. A thin vertical slice that runs.
- **Product-ready done** — the capability a document/README claims is actually present,
  wired, reachable by a judge, and covered by tests of real depth. The submission bar is
  product-ready, not tracer-bullet.
- **Wired** — reachable at runtime through the composition root, not just present as a file
  or an architectural intention in a comment.

---

## R0 — The rubric as acceptance criteria (what judges score)

**User story:** As a judge, I score this entry against the Kiroween rubric, so each rubric
dimension must map to concrete, checkable evidence in a fresh clone.

**Acceptance — each dimension has a named, verifiable artifact:**

| # | Rubric dimension (best-practice, per A1) | "Done" means | Where a judge sees it |
|---|---|---|---|
| R0.1 | **Fits the category** | A reusable skeleton + **two meaningfully different apps** built from it | `src/` (skeleton) + `apps/planner` + `apps/inventory`; distinct data, workflows, policies |
| R0.2 | **Technical execution** | Real domain logic + deterministic enforcement, not stubs; tests of depth; green CI on a fresh clone | `verify` + `app (planner)` + `app (inventory)` all green; tests cover each invariant pass+fail |
| R0.3 | **Kiro usage (spec-driven)** | Public `.kiro/` with real requirements→design→tasks triads, steering, agent configs, dev evidence | `.kiro/specs/*`, `.kiro/steering/*`, `.kiro/agents/*` present in a fresh clone |
| R0.4 | **Originality / core idea** | The user-vs-creator customization boundary is demonstrated, including a **rejected violation** with a recoverable view | Planner + Inventory each demo an agenda/focus transform **and** a cited rejection |
| R0.5 | **Completeness end-to-end** | A judge can run the demo path (R1) start to finish without the dev's machine or unpublished deps | Fresh-clone run instructions in README; demo URLs live (R3) |
| R0.6 | **Honesty / scope clarity** | Real vs. test-double vs. optional-model vs. unmerged is labeled, not overstated | README + this spec's "real vs stubbed" (see `design.md`) |
| R0.7 | **Presentation** | Public repo, **<3-min YouTube demo**, functional demo URLs, write-up crediting Kiro | Submission package items (R6) |

**A dimension with no artifact in a fresh clone is NOT done, regardless of what a README or
a PR claims.**

---

## R1 — The end-to-end demo path (what a judge clicks and sees)

**User story:** As a judge with only a fresh clone (or a demo URL) and the documented
prerequisites, I can walk the whole story in under a few minutes.

**Acceptance — the canonical path runs, in order, with no dev-machine state:**

1. **Clone & run.** A fresh clone of `user-tailored-ui` builds and starts both apps using
   only documented prerequisites (Node ≥ 20; no unpublished deps; no existing workspace).
2. **Planner — real workflow first.** Create/edit/reorder/complete tasks; they persist
   across reload.
3. **Planner — customize.** Ask the in-app agent (natural language) to "turn my board into
   a focused daily agenda"; a **validated preview** appears; **apply** it; task identities,
   contents, actions and the required complete control are preserved.
4. **Planner — rejection (the required beat).** Ask for something that violates policy
   (remove the complete control / exceed font-scale / non-approved component / disallowed
   action); the system **rejects it, names the rule, and keeps the last valid view**.
5. **Planner — save / reopen / undo.** Reload shows the applied customization; undo restores
   a prior valid view without touching tasks.
6. **Inventory — the second, distinct app.** Repeat the shape with different data and a
   different transform ("focus on low stock to reorder"), proving the skeleton is reused, not
   copied.
7. **Honesty beat.** The agent result is labeled **simulated** (test-double) unless a key is
   configured; nothing simulated is presented as real.

**Acceptance bars for the path:**
- Steps 2–7 run **offline with the labeled test-double** — no API key, no network required.
- The optional real-agent path (Claude subscription / `ANTHROPIC_API_KEY`) is documented and
  degrades honestly when absent.
- Every step above is reproducible from the README of a fresh clone — **not** from this
  session's machine.

---

## R2 — Per-repo acceptance bars (what each repo must prove)

Each repo is "submission-ready" only when its bar is met **on its default branch** (a judge
clones `main`, not a feature branch). "Green open PR" is progress, not done.

### R2.1 — `user-tailored-ui` (submission repo)
- `main` builds; `verify` + both `app (*)` jobs green on a fresh clone.
- Real domain customization boundary + deterministic validator (all invariants + tampering
  guards) present in `src/`.
- **Both** apps vendored under `apps/*`, each runnable, each with its own green matrix job.
- Public `.kiro/` with the foundation + planner triads, steering, reviewer agent, and this
  submission spec.
- README documents the fresh-clone run, the real-vs-test-double split, and the CI/CD gate.

### R2.2 — `browser-repos`
- **Bar:** the library's claimed capability (repo lifecycle, offline git ops, branches,
  export/import, durability, public API) is present **on `main`**, with the error taxonomy
  and MV3/IndexedDB boundaries honored, and CI green on a fresh clone of `main`.
- **Honesty bar:** if any claimed capability is not on `main`, the README must say so (no
  overstatement), **or** the capability must be merged.

### R2.3 — `user-tailored-planner` (standalone)
- **Bar:** `main` is either (a) the real planner slice, **or** (b) a seed whose README
  honestly states the runnable planner lives in `user-tailored-ui/apps/planner`.
- The submission does not depend on this repo's `main` for the demo (the vendored copy is
  authoritative), but a judge who opens it must not be misled.

### R2.4 — `user-tailored-inventory` (standalone)
- **Bar:** `main` holds the real inventory slice (create/edit/adjust-qty/delete, IndexedDB
  store, low-stock focus customization, four violation fixtures), CI green. **Met today.**

### R2.5 — `TailoredUI` (fork)
- **Bar:** present and attributed (MIT, upstream Aman Singh preserved); only product-needed
  changes; no app policy leaked into the fork. If the UI capability is satisfied by an
  in-repo port adapter rather than the fork, README states that plainly.

---

## R3 — Demo URLs & judge access

**User story:** As a judge, I may not clone; I may click a URL.

**Acceptance:**
- At least the **submission repo's two apps** are reachable at **functional public demo
  URLs** (or the submission explicitly says "clone to run" and the fresh-clone path is
  trivial and documented).
- Demo URLs stay live through **Jan 29, 2027** (A3).
- A deploy path exists and is documented (static build is sufficient; the apps are
  offline-first on the test-double).

---

## R4 — Kiro spec-driven evidence (the `.kiro/` story)

**Acceptance:**
- `.kiro/` is **public and never gitignored** (hackathon requirement).
- A fresh clone shows real triads (requirements/design/tasks), steering, agent configs, and
  development evidence (handoff notes, the CI/CD pipeline spec, this submission spec).
- The spec-driven workflow is legible: a judge can trace a feature from its requirement to
  its design to its tasks to the code.

---

## R5 — Honesty & compliance invariants (non-negotiable)

**Acceptance:**
- **No overstatement.** Every "done" claim in README/specs is either product-ready or
  labeled as intent/planned/optional/unmerged. Tracer-bullet is never called done.
- **Simulated vs real** is labeled in the UI and docs; a simulated result is never shown as
  real and never the reverse.
- **No secrets** in repos, logs, commits, exports, or URLs; the user sets any key themselves.
- **Licensing/attribution** complete: new repos dual `MIT OR Apache-2.0`; fork MIT with
  upstream credit; vendored third-party code attributed in NOTICE.
- **Untrusted input** (user requests + model proposals) can never bypass policy/validators.

---

## R6 — Submission package (the Devpost deliverable)

**Acceptance — all present before Dec 4, 2026, 2:00 PM PST (A3):**
- [ ] Public GitHub repo; fresh clone runs both apps + both customization flows with only
      documented prerequisites.
- [ ] Meaningful public `.kiro/` (specs, steering, dev evidence).
- [ ] Reused/upstream code disclosed (TailoredUI fork, isomorphic-git, LightningFS, etc.) in
      NOTICE + README.
- [ ] Functional demo URLs (R3).
- [ ] Public **YouTube demo under 3 minutes** walking the R1 path.
- [ ] Write-up crediting **Kiro** and **Kiroween 2026**.
- [ ] Packaging + deployment verified on a clean machine before submitting.
- [ ] (Bonus) DEV blog draft, human-reviewed, AI-writing disclosed, published in-window.

---

## Out of scope (this submission)

- A general policy framework or universal-correctness claims (steering `10`).
- Production multi-user auth (user separation shown via scoped ids).
- Upstream PRs to TailoredUI during the hackathon (post-event).

---
inclusion: always
---

# Kiroween 2026 — Compliance checklist (living document)

Authoritative rules: https://kiroween.devpost.com/rules — re-check before submission.
(Automated fetch of the rules page returns 403; facts below corroborated via web search
and the PM brief. Verify manually before relying on any dated item.)

## Category: Skeleton Crew
- [ ] Lean, flexible reusable template (the skeleton in this repo).
- [ ] **Two distinct applications** built from it (Planner + Inventory) with meaningfully
      different data, workflows, and customization boundaries.
- [ ] Both apps included as **reproducible runnable versions in separate folders within
      user-tailored-ui**, with docs on how they are produced/updated from their authoritative repos.

## Eligibility / timeline (verify on the rules page)
- [ ] Built during the submission period (approx. **Oct 30 – Dec 4, 2026**). Nothing reused
      from before the window as the project itself.
- [ ] **Submission closes Dec 4, 2026, 2:00 PM PST.**
- [ ] Free judge access through **Jan 29, 2027** (demo URLs + accounts as needed).

## Submission package
- [ ] Public GitHub repo; a **fresh clone** contains source, assets, and instructions
      sufficient to run both apps and their customization flows using only documented
      external prerequisites — no unpublished deps, no reliance on an existing workspace.
- [ ] Meaningful **Kiro specs, steering, and development evidence** in the tracked, public
      root `.kiro/` of this repo.
- [ ] **Disclose reused upstream / pre-existing code** (TailoredUI fork, isomorphic-git,
      LightningFS, etc.) — see NOTICE and README.
- [ ] Functional **demo URLs**.
- [ ] Public **YouTube demo under 3 minutes**.
- [ ] Verify packaging + deployment **before** submitting.

## Licensing / attribution
- [ ] New repos dual-licensed `MIT OR Apache-2.0`.
- [ ] TailoredUI fork remains MIT with upstream attribution preserved.
- [ ] All vendored third-party code: license + attribution recorded.

## Bonus: DEV blog
- [ ] Unpublished DEV drafts via `@furkankoykiran/devto-mcp` (env `DEVTO_API_KEY`;
      configured in `.kiro/settings/mcp.json` via Web secret syntax, never committed) at
      milestones; **never auto-publish**; ask before editing published posts.
- [ ] Credit Kiro and Kiroween 2026 in the qualifying write-up.
- [ ] Keep AI-writing disclosure on the human-review checklist.
- [ ] For bonus: PM publishes the reviewed post during the submission period; include URL
      in the submission.

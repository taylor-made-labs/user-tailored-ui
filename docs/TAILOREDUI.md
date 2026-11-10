# TailoredUI fork spike (T4.1)

Date: 2026-11-10. Read-only spike. Nothing was pushed to the fork.

## Verdict

**NO-GO as a runtime dependency, as TailoredUI exists today.**
**GO on a small, bounded fork change** if we want "we use TailoredUI" to be true (see "What to do").

Why, in one line: TailoredUI is a website (a Tailwind component gallery), not a library.
It has nothing our product can import today, and the best idea in it lives only on an
upstream branch.

## What the fork is

| Fact | Value (checked by cloning) |
|---|---|
| Repo | `taylor-made-labs/TailoredUI`, fork of `TailoredUI/TailoredUI` |
| `main` head | `8d87196` (2024-05-10). 0 commits ahead of upstream |
| Product | Vite + React 18 + Tailwind 3 + Redux site: home page, navbar, 8 static demo components |
| Packaging | `"private": true`. No `main`, `exports`, `types`, or build for a library. Only `vite build` of the site |
| Size | about 5,100 lines of TS/TSX in `src/`, most of it site chrome (home page, navbar, icons) |
| Components on `main` | `Button1`, `Button2` (15 and 11 lines, hard-coded Tailwind classes) plus static demos (Card, Avatar, Accordion, Pagination, Radio, Hr, Navbar, Button) |
| Customization on `main` | None. No theme editor, no tokens. Redux only tracks which demo is selected |
| Tests | None |
| CI | Lint only (`lint.yml`) |
| License | MIT, Copyright 2023 Aman Singh. Fork use is allowed. Keep the notice (R6.4) |
| Activity | Last upstream commit on any branch: 2024-08-08. Dormant |

## What `develop` is (verified)

The spec guessed it was upstream's. **Confirmed.** `develop` (`311f4e3`) is upstream's
integration branch. It is 29 commits ahead of `main`, 0 behind. All commits are from
upstream authors (chandel-aman, Aman Singh, PranavKeshav24, Akash, and others). We have
no commits there.

What it adds beyond `main`:

- A `collections` page and a preview/playground (`Preview.tsx`, 213 lines), a resizable
  box, a viewport selector, drag handling.
- **A JSON option schema per component**: `simplebutton.config.json` lists options
  (label, colors, size, typography) each with a `type` (`text`, `color`, `group`), a
  `default`, and a Tailwind `className` prefix (`bg-`, `text-`, `w-`, `p-`).
- One real component using it: `SimpleButton` (15 lines).
- Still no tests, still `private`, still no library build.

`aman`, `dummy`, `fixes` are small upstream branches (`fixes` is 0 ahead of `main`).
Not used.

## What the product needs (R5, R6)

| Need | From | Does TailoredUI have it? |
|---|---|---|
| Token model: `accent`, `fontScale`, `density`, contrast floor (R5.1) | the foundation validator | No. Only free-form Tailwind class strings (on `develop`) |
| Component set with ids the policy can allow (R5.2) | an adapter + descriptors | Barely: 1 button on `develop`, 2 on `main`. Planner needs agenda, task list, add-task box. Inventory needs table, list, adjust-qty control. None exist |
| Slots / layout (R5.2, R5.3) | the foundation | No |
| Data-only descriptors (no code from the agent) | adapter | Partly: the `develop` option JSON is the right idea. It is a form schema, not a descriptor we can validate against |
| Importable package, pinned by SHA (R6.3) | the fork | **No.** Needs a library entry and build |
| Tests we can trust | CI | No |

## What fits

- The **option-schema idea** (JSON file per component, typed options, default, class
  prefix). It maps to our `UiCapability` descriptors.
- MIT license and a Tailwind base, which matches what we render.

## What does not fit

- It is a gallery site. Its UI (home, navbar, redux) is not what we need.
- Class-prefix options (`bg-`, `w-`) take any value. Our rules need bounded numbers,
  enums, and a contrast check. The schema cannot say "fontScale 1 to 2".
- The needed components do not exist. We would write them ourselves either way.

## What must be fixed or added in the fork (rough size)

Only if we proceed with the bounded option below.

| Change | Rough size |
|---|---|
| Branch `utui/lib-entry` from **`main`** (not `develop`): add `src/lib/index.ts`, Vite library build (`build:lib`), `exports` + `types`, drop `private` for the lib | 0.5 day |
| Port `SimpleButton` + its option JSON from `develop` (cherry-pick, keep authorship) | 0.25 day |
| Add 3 to 5 components our two apps use (Button, Card, List, Input, Table) as pure components taking props, with an option JSON each | 1 to 1.5 days |
| A few unit tests (render each component) and a CI job | 0.5 day |
| `TailoredUiAdapter` in our repo: descriptors from the option JSON, bounded by our policy | 1 day |
| Replace the in-repo adapter in both apps, update tests | 0.5 to 1 day |
| **Total** | **about 4 to 5 days** |

Pin by SHA via tarball, same method as `browser-repos` (R6.3). One concern per commit.

## Risks

- Upstream is dormant, so no help and no conflicts. That is fine for a fork.
- Most of the work is writing components, not "using" TailoredUI. The honest claim would
  be "components start from TailoredUI's button and option-schema design".
- 4 to 5 days competes with higher-impact gaps (real inference, broker, real-browser
  tests, hosting) from the submission audit.

## What to do

1. **Now:** keep the in-repo adapter. README already says the fork is not on the demo
   path. Keep saying it (R6.6). Do not claim use of the fork.
2. **If the team wants the fork to be real**, do the bounded change above after the
   inference, broker, and Playwright tasks (T2, T3, T4.3). Start with the lib entry and
   `SimpleButton`, and show one component rendered from the fork in a Playwright run
   (T4.2 check). Stop there if time runs out; it is still honest.
3. Do not branch from `develop`. It carries unreviewed community changes and a gallery
   UI we do not need. Cherry-pick the pieces we want.

## Fork commits the product depends on

None. The product depends on zero fork commits today (R6.5).

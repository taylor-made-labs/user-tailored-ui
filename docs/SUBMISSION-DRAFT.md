# DRAFT: Kiroween 2026 submission write-up (Skeleton Crew)

> Status: draft for a human to review and edit. Not submitted. Facts below were checked
> against the repo on 2026-11-09. Items in [brackets] need a human.

## One line

user-tailored-ui lets end users reshape an app by asking an in-app AI agent, while the app's
creator keeps control through rules that are checked by deterministic code, not by the model.

## What it does

A user types a request such as "turn my board into a focused daily agenda". The agent
proposes a configuration. The proposal is treated as untrusted. A validator checks it against
the creator's policy. If it breaks a rule, it is rejected with the rule cited, and the last
valid view stays. If it passes, the user previews, applies, saves, reopens and undoes it.
Saved history is stored as git commits in the browser (IndexedDB).

Two different apps use the same enforcement core: a Planner and an Inventory app.

## Built with Kiro

Built with [Kiro](https://kiro.dev) for Kiroween 2026, spec-driven. Requirements, design and
task files, steering rules and agent definitions are in the public `.kiro/` folder of each
repo. Development used Kiro Crew workers that opened pull requests, with a CI gate and an
independent review step before merge. [Add: which Kiro features you used, with screenshots.]

## Repositories

| Repo | Role |
|---|---|
| user-tailored-ui | Foundation, enforcement core, vendored runnable copies of both apps |
| browser-repos | IndexedDB-backed git library (own project, reusable) |
| user-tailored-planner | Planner app source |
| user-tailored-inventory | Inventory app source |
| TailoredUI | Fork of upstream UI library; credited, not on the demo path |

## Reused upstream code (disclosure)

- **isomorphic-git** (MIT) and **@isomorphic-git/lightning-fs** (MIT): the git engine and
  IndexedDB filesystem inside browser-repos. Bundled into the apps through a vendored
  browser-repos tarball.
- **TailoredUI** by Aman Singh (MIT): forked as taylor-made-labs/TailoredUI and credited in
  NOTICE. The demo apps do not import it. Each app has its own small in-repo adapter.
- **React, Vite, Vitest, TypeScript, ESLint**: standard tooling, versions pinned in lockfiles.
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): optional adapter for the real model
  path. Not used in CI or the default demo.
- The Planner and Inventory apps are vendored into user-tailored-ui as copies of their own
  repos. They are our code.

## Honest limits

- The default agent in the demo is a **labeled test double** (`simulated: true`), not a model.
  The real Claude adapter exists and has unit tests with the SDK mocked. Its live smoke test
  is skipped unless you run it with a Claude login.
- Enforcement covers a finite list of rules, not all correctness.
- History persistence is tested under Node with a fake IndexedDB. It has not been checked
  by an automated real-browser test.
- The apps use a browser-repos build from slice 5, not its latest `main`.
- The browser-repos MV3 claim is partly proven: see `browser-repos/docs/mv3-compat.md`.
- [Hosted demo URLs: not yet deployed.] [Demo video: not yet recorded.]

## AI use disclosure

Most code and docs in these repos were written by AI agents under human direction and
reviewed by CI and an AI review step. [Human: confirm wording against the Devpost rules.]

## Links to fill in

[Demo URL planner] [Demo URL inventory] [YouTube video] [Repo links]

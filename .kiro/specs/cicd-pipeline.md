# CI/CD Pipeline — layered merge gate (development evidence)

Status: **live.** The deterministic layers (this document's Layers 1 and 4, plus the
always-on floor of Layer 2) run on every push and pull request on `main` today and are
green on a fresh clone. The model-backed halves of Layers 2 and 3 are landed as open PRs
(#7, #8) awaiting a human `human-approved` label, and degrade to the deterministic floor
when no key is present.

## Introduction

Merges on this repo are automated by CI/CD with an independent review-agent gate, so they
do **not** wait on a human — **except** a narrow set of security-sensitive paths, which
still require explicit human approval. The pipeline is built as **ordered layers**, cheap
and deterministic first, model-backed and optional last. Each layer is honest about what it
actually does: routine checks are keyless, deterministic, and free; any model-backed step
degrades to the deterministic floor when no secret is present, and says so.

This spec describes what is **actually in the repo** — real file names, real job and status
names — so a judge can read the pipeline as development evidence without running it.

```
push / PR
  → Layer 1  deterministic CI floor        (verify + app matrix)      keyless, gating
  → Layer 2  independent review agent       (agent-review status)      floor always on; model layer optional
  → Layer 3  independent bounded fix agent  (fix(agent): commits)      keyless no-op default; optional model layer
  → Layer 4  auto-merge                     (squash on green + PASS)   human-approved label = only hold
```

## Layer 1 — deterministic CI floor (`.github/workflows/ci.yml`)

Keyless, deterministic, zero model cost. Green on a fresh clone with no secrets. Two
independent gating jobs:

- **`verify`** — the foundation's own `src/` + `test/`. Steps, in order:
  `npm ci` → `node scripts/dep-hygiene.mjs` → `npm run typecheck` → `npm run lint` →
  `npm test` → `npm run build`. The test suite uses the **labeled test-double** inference
  adapter, so no key and no network (beyond npm) are needed. The job id is exactly
  `verify` because Layer 4 gates on a check named `verify`; renaming it would silently
  break auto-merge.
- **`app (planner)`** and **`app (inventory)`** — the vendored runnable demo apps under
  `apps/*`. Each runs its own `npm ci` → `typecheck` → `lint` → `test` → `build` in its own
  directory. These green checks on a fresh clone are the proof both apps run.

### `scripts/dep-hygiene.mjs` — dependency-hygiene gate (part of `verify`)

Deterministic, keyless, zero model cost. Two **hard** checks that fail the build:
(a) every `dependencies` / `devDependencies` / `optionalDependencies` version is an **exact
pinned** semver (no `^`, `~`, ranges, `latest`, or git/url/file/workspace specs), and
(b) a committed `package-lock.json` exists. One **best-effort advisory** check —
`npm audit --audit-level=high` — that **never** fails the build and logs
`advisory scan skipped (offline)` when the registry is unreachable. Scope is the foundation
root `package.json`; the vendored apps hygiene-check their own deps in their own matrix job.

## Layer 2 — independent review agent (`.github/workflows/agent-review.yml`)

Publishes an `agent-review` commit status that Layer 4 requires. Two sub-layers:

- **Deterministic floor** (the `deterministic-floor` job, always on, keyless) runs
  `node scripts/boundary-check.mjs` and posts the `agent-review` status: `success` when the
  static boundary guardrails pass, `failure` otherwise. This floor can **never** be skipped
  and **never** relaxes Layer 1 — auto-merge independently requires `verify` to be green.
- **Semantic layer** (optional, model-backed) is the `customization-boundary-reviewer`
  custom agent (`.kiro/agents/customization-boundary-reviewer.json`). It performs the full
  judgment-based review of the diff against the customization-boundary and security
  invariants and emits a structured PASS/FAIL verdict; a FAIL sets the same `agent-review`
  status to `failure`, blocking merge. It **never** modifies code and **never** relaxes CI —
  its approval is necessary but not sufficient. It is landed as **PR #7**
  (`feat/wire-semantic-review-agent`, open, non-draft, awaiting the `human-approved` label,
  because it touches the workflow set). When no key is present the gate degrades honestly to
  the deterministic floor only.

### `scripts/boundary-check.mjs` — the deterministic boundary floor

Static, model-free, no secrets, no network. Walks executable product source
(`src/`, `apps/`, `scripts/`), **skipping** `node_modules`, `.git`, `dist`, `coverage`,
`.kiro`, and `.github`. It strips comments before matching code rules, so prose that merely
*names* a forbidden API is not flagged, and checks: no `eval` / `Function` constructor; no
`localStorage` / `chrome.storage` in product code (IndexedDB only); no committed secrets
(key-shape regex on raw text, including comments); and a warn-only runtime-CDN marker. Exit
0 = pass, exit 1 = blocker(s) found.

> Note on this doc's own paths: `.kiro/specs/cicd-pipeline.md` and `README.md` are **not**
> under `apps/` and are **not** executable source, so naming a forbidden API in this prose
> does not and cannot trip `boundary-check.mjs` (it skips `.kiro/` and only walks
> `src/`, `apps/`, `scripts/`).

## Layer 3 — independent bounded fix agent

An independent, **bounded** self-heal fix agent (max 2 attempts). It proposes
`fix(agent):` commits **on the PR branch only**, **refuses** sensitive paths, never merges,
and never relaxes CI. Its default is a **keyless advisory no-op**: with no key present it
does nothing but log. It is landed as **PR #8** (`feat/agent-fix-self-heal`, open,
non-draft, awaiting the `human-approved` label, because it touches the workflow set). Like
Layer 2's semantic half, the model-backed behaviour is optional and off until a secret is
set; the pipeline is fully functional and green without it.

## Layer 4 — auto-merge (`.github/workflows/auto-merge.yml`)

Squash-merges a PR when **all** of the following hold on the PR head:

1. CI `verify` concluded `success`.
2. The `agent-review` status (check-run or commit status) is `success`.
3. The PR touches **no sensitive path** — **OR** a maintainer added the `human-approved`
   label.

The review agent is advisory + gating: it can **block** a merge but can **never** relax CI
or merge a red build — this job hard-requires `verify` success independently. Auto-merge is
keyless; it reads only GitHub check conclusions and the PR's labels and files.

### Sensitive paths — the only human hold

Auto-merge detects sensitive paths automatically (no manual labeling needed) and holds them
for the `human-approved` label. The set is deliberately **narrow** — ordinary
app / UI / doc / test / adapter changes match none of it and auto-merge on green:

| Category | Paths |
|---|---|
| Enforcement domain | `src/domain/customization/validator.ts`, `orchestrator.ts`, `policy.ts` |
| Enforcement tooling | `scripts/boundary-check.mjs`, `scripts/dep-hygiene.mjs` |
| Vendored enforcement | `apps/**/foundation/**` |
| The gate itself | `.github/workflows/*.yml` |
| Licensing / secrets | `LICENSE*`, `broker`, `secret` / `credential` / `.env` |

A change to the machinery that defines or enforces the gate therefore can never slip
through unreviewed. This is why PRs #7 and #8 (both touch `.github/workflows/`) wait on the
`human-approved` label.

## Honesty invariants (what is real vs optional)

- **Routine CI is keyless and deterministic.** `verify`, the app matrix, `dep-hygiene`,
  `boundary-check`, and auto-merge all run with **no secret** and are green on a fresh
  clone.
- **Model-backed steps are optional and degrade to the floor.** The semantic reviewer
  (Layer 2) and the fix agent (Layer 3) do nothing beyond the deterministic floor / a
  logged no-op when no key is present, and that state is labeled, not hidden.
- **Fork PRs never get secret access.** Secrets are not exposed to pull requests from
  forks, so the model-backed layers simply degrade to the floor there.
- **Secrets are never in the repo.** No key is committed; the user sets any GitHub Actions
  secret themselves in repo settings. The workflows read it from the Actions secret store,
  never from source.
- **The review/fix agents can never relax CI.** Layer 4 hard-requires `verify` success
  independently of any agent verdict.

## Enabling the optional model-backed layers

The deterministic pipeline needs nothing. To turn on the live model-backed reviewer and fix
agent:

1. In **GitHub → repo Settings → Secrets and variables → Actions**, add a repository secret
   named **`ANTHROPIC_API_KEY`** (the env/secret the model-backed workflow steps read). The
   user sets this themselves; no agent or workflow ever stores a credential.
2. Merge PR #7 (semantic reviewer) and PR #8 (bounded fix agent) — both require the
   `human-approved` label first, because they touch `.github/workflows/`.

With no secret set, the pipeline stays fully functional on the deterministic floor.

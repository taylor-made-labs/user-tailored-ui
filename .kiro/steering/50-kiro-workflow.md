---
inclusion: always
---

# How we use Kiro on this project (enforced workflow)

Decisions about maximizing Kiro, confirmed with the PM. These compound across sessions.

## Spec-driven, and specs ARE evidence
- All non-trivial work flows through specs in `.kiro/specs/<name>/`
  (`requirements.md` → `design.md` → `tasks.md`). This doubles as the hackathon-required
  "meaningful Kiro specs and development evidence" in a public `.kiro/`.
- Prefer multi-repo spec sessions when a change spans repos (e.g. browser-repos store +
  user-tailored-ui port). Use parallel task waves for independent leaf tasks.
- Keep `tasks.md` status current; link tasks to requirement ids.

## Steering
- `always` files hold cross-cutting rules (project, boundary, engineering, methodology,
  credentials, this file). Area-specific rules use `fileMatch` so they load only when
  relevant (see 60-browser-repos with its fileMatch front matter).
- Use `#[[file:...]]` references to keep authoritative contracts live in steering rather
  than duplicated.

## Agents & review
- A committed custom agent `.kiro/agents/customization-boundary-reviewer.*` reviews changes
  against the product's safety invariants (no generated-code execution, validate-before-
  activate, secrets never in Git/exports/logs, policy > defaults > preferences,
  IndexedDB-only, MV3 constraints). Custom agents on Web must be committed to `.kiro/agents/`.
- Use subagents to parallelize independent app work (Planner vs Inventory) once the shared
  foundation is frozen.

## Quality gate = CI (NOT hooks)
- Agent Hooks do not execute on Kiro Web, so we do NOT rely on them to gate anything here.
  GitHub Actions CI is the enforcement, which also gives judges green checks on a fresh clone.
- We may author hook JSON for IDE/CLI users, but it is advisory only on Web.

## Automated merge pipeline (PM directive: do not wait on the human)
- Merges are automated by CI/CD with an **independent review-agent step**. Merge requires:
  (1) CI green (typecheck/lint/test/build) AND (2) the review agent's PASS verdict.
- The review agent is **advisory + gating**: it can block a merge but can NEVER relax CI or
  merge a red build — mirroring "untrusted proposals cannot bypass enforcement".
- **Human-gate exception (narrow):** changes touching security-sensitive paths still require
  the PM's explicit approval before auto-merge: the validator/enforcement code, anything
  handling secrets/keys, the broker endpoint, and license files. Everything else
  (app features, UI, docs, tests, adapters) auto-merges on green + review PASS.

## Memory
- Durable cross-repo preferences/decisions are persisted via the learnings tool. Session
  continuity comes from specs + steering + committed state + CI (no Web background jobs).

## MCP
- `@furkankoykiran/devto-mcp` is declared in `.kiro/settings/mcp.json`; the DEV token is
  supplied via Web secret syntax at sandbox start, never committed. Blog posts are drafts
  only; never auto-publish; ask before editing published posts.

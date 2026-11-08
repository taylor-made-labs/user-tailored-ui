#!/usr/bin/env node
/**
 * INDEPENDENT FIX AGENT — the self-healing half of the CI/CD pipeline.
 *
 * When a PR's CI ("verify") fails OR its "agent-review" status is failure, this agent is
 * invoked (by .github/workflows/agent-fix.yml) to diagnose and, when safe and a model key
 * is present, propose a bounded fix commit ON THE PR BRANCH. It can NEVER merge, NEVER
 * relax CI, and NEVER edit the enforcement machinery. It only proposes fixes; auto-merge
 * independently re-requires a green "verify".
 *
 * This sits alongside the review agent (scripts/semantic-review.mjs): review BLOCKS bad
 * changes, fix HEALS broken ones. Both are honest about their limits and both keep the
 * deterministic floor untouchable.
 *
 * ── Non-negotiable invariants (mirror the PR directive + steering 50-kiro-workflow) ──
 *   1. BOUNDED: at most MAX_ATTEMPTS fix attempts per PR, counted from existing
 *      `fix(agent):` commits on the branch. At/over the cap it posts a "human needed"
 *      comment and STOPS — it never loops forever.
 *   2. PR BRANCH ONLY: any commit it makes is on the PR head branch, prefixed
 *      `fix(agent):`, and the PR is labeled `agent-fixed`. It never touches main.
 *   3. NEVER weakens enforcement: if the only files that would need editing are
 *      sensitive/enforcement paths (validator/orchestrator/policy, boundary-check,
 *      dep-hygiene, apps foundation, workflows, broker, LICENSE, secrets), it REFUSES,
 *      posts a comment asking for the human `human-approved` label, and STOPS.
 *   4. KEYLESS-SAFE DEFAULT: with NO model key (fresh clone, fork PR), it runs as an
 *      honest ADVISORY no-op — it posts a diagnosis comment and exits 0 (GREEN) WITHOUT
 *      touching code. The live model-backed fixer is gated behind ANTHROPIC_API_KEY,
 *      which the user sets themselves. A simulated fix is NEVER presented as a real one.
 *   5. NEVER fakes green: this script exiting 0 means "the fixer ran cleanly" (advisory
 *      or a proposed fix pushed), NOT "the build is green". Only CI's own "verify" can be
 *      green, and auto-merge re-checks it independently.
 *
 * ── Security ──
 *   - ANTHROPIC_API_KEY is read from the environment only (wired from Actions secrets by
 *     the workflow). It is NEVER printed, logged, or written anywhere.
 *   - Fork PRs do not receive secrets, so a fork PR always takes the advisory path.
 *
 * ── Env (supplied by the workflow) ──
 *   GH_PR_NUMBER     the target PR number (required)
 *   GH_PR_HEAD_REF   the PR head branch name (required for a live fix)
 *   GH_PR_HEAD_REPO  head repo full name (owner/name); if it differs from GH_BASE_REPO
 *                    the PR is a fork and the fixer stays advisory-only
 *   GH_BASE_REPO     base repo full name (owner/name)
 *   GH_FAILED_WF     which workflow failed ("CI" | "Agent Review") — advisory context
 *   AGENT_FIX_MODEL  optional model override (default claude-haiku-4-5)
 *   ANTHROPIC_API_KEY  optional; absent => advisory mode
 *
 * Exit codes:
 *   0  = ran cleanly (advisory no-op, OR a bounded fix was committed+pushed, OR cap hit
 *        and a human-needed comment was posted). NOT a claim that the build is green.
 *   2  = infrastructure problem (missing required env, git/push plumbing failed). The
 *        workflow treats this as non-fatal: the red CI still stands and gates the merge.
 *
 * NOTE: this script NEVER exits 1. It has no authority to "fail" a PR — CI already did
 * that. Its job is to try to help or to honestly report it cannot, never to add a second
 * red signal that could be mistaken for the build's verdict.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Max bounded fix attempts per PR. shortcut: fixed cap of 2; raise here if a richer
// attempt-tracking scheme (e.g. per-failure-class budgets) is ever needed.
const MAX_ATTEMPTS = 2;
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = process.env.AGENT_FIX_MODEL || 'claude-haiku-4-5';
const MAX_TOKENS = 2048;

// Enforcement / sensitive paths the fixer must NEVER edit. Kept in lock-step with the
// sensitive set in .github/workflows/auto-merge.yml — a fix that touched any of these
// would be weakening the gate, which is exactly what a self-healing agent must not do.
const SENSITIVE_PATTERNS = [
  /(^|\/)src\/domain\/customization\/validator\.ts$/,
  /(^|\/)src\/domain\/customization\/orchestrator\.ts$/,
  /(^|\/)src\/domain\/customization\/policy\.ts$/,
  /(^|\/)scripts\/boundary-check\.mjs$/,
  /(^|\/)scripts\/dep-hygiene\.mjs$/,
  /(^|\/)apps\/.+\/foundation\/.+/,
  /(^|\/)\.github\/workflows\/.+\.ya?ml$/,
  /broker/i,
  /(^|\/)LICENSE/i,
  /secret|credential|\.env(\.|$)/i,
];

function log(msg) {
  console.log(`[agent-fix] ${msg}`);
}

function isSensitive(path) {
  return SENSITIVE_PATTERNS.some((rx) => rx.test(path));
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}

/** Post a PR comment via the gh CLI (the workflow authenticates gh for us). */
function postComment(prNumber, body) {
  try {
    execFileSync('gh', ['pr', 'comment', String(prNumber), '--body', body], {
      encoding: 'utf8',
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    log('posted PR comment.');
  } catch (err) {
    log(`WARN: could not post PR comment: ${err?.message ?? err}`);
  }
}

/** Add a label via gh; best-effort. */
function addLabel(prNumber, label) {
  try {
    execFileSync('gh', ['pr', 'edit', String(prNumber), '--add-label', label], {
      encoding: 'utf8',
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    log(`labeled PR with "${label}".`);
  } catch (err) {
    log(`WARN: could not add label "${label}": ${err?.message ?? err}`);
  }
}

// ── Required context ────────────────────────────────────────────────────────
const prNumber = process.env.GH_PR_NUMBER;
if (!prNumber) {
  log('INFRASTRUCTURE: GH_PR_NUMBER not set; nothing to act on. (CI red still gates)');
  process.exit(2);
}
const baseRepo = process.env.GH_BASE_REPO || '';
const headRepo = process.env.GH_PR_HEAD_REPO || '';
const headRef = process.env.GH_PR_HEAD_REF || '';
const failedWf = process.env.GH_FAILED_WF || 'CI';
const isFork = !!headRepo && !!baseRepo && headRepo !== baseRepo;
const hasKey = !!process.env.ANTHROPIC_API_KEY;

log(`pr=#${prNumber} failedWorkflow=${failedWf} fork=${isFork} keyPresent=${hasKey}`);

// ── Attempt cap: count prior fix(agent): commits on the branch. ───────────────
let attempts = 0;
try {
  const subjects = git(['log', '--pretty=%s', 'HEAD~50..HEAD']).split('\n');
  attempts = subjects.filter((s) => s.startsWith('fix(agent):')).length;
} catch {
  // Shallow history or a fresh branch — treat as zero prior attempts.
  attempts = 0;
}
log(`prior fix(agent) attempts on branch: ${attempts} (cap ${MAX_ATTEMPTS}).`);

if (attempts >= MAX_ATTEMPTS) {
  log('attempt cap reached — stopping and asking for a human.');
  postComment(
    prNumber,
    `**agent-fix: human needed.**\n\n` +
      `The self-healing fix agent has already made ${attempts} bounded attempt(s) ` +
      `(cap ${MAX_ATTEMPTS}) on this PR and the \`${failedWf}\` checks are still red. ` +
      `It will not try again — bounded by design, never an infinite loop.\n\n` +
      `A human should take it from here. CI remains the gate; nothing merges while it is red.`,
  );
  process.exit(0);
}

// ── Advisory diagnosis (always produced, model or not). ──────────────────────
function buildAdvisory() {
  return (
    `**agent-fix: advisory diagnosis.**\n\n` +
    `The \`${failedWf}\` checks on this PR are failing. ` +
    `${
      hasKey
        ? 'A model key is present, so a live fix was attempted (see the result below).'
        : 'No model key is present, so the fixer is in **advisory mode** (no-op): it will ' +
          'NOT change code. This is the default, keyless-safe path — set `ANTHROPIC_API_KEY` ' +
          'as an Actions secret to enable live, bounded fixes.'
    }\n\n` +
    `Next steps for a maintainer:\n` +
    `- Open the failed \`${failedWf}\` run and read the first failing step.\n` +
    `- Typecheck/lint/test failures are usually the fix agent's domain once a key is set.\n` +
    `- Changes to enforcement paths (validator/orchestrator/policy, boundary-check, ` +
    `dep-hygiene, workflows, apps foundation, LICENSE, secrets) are intentionally OUT of ` +
    `scope for the fixer and need the \`human-approved\` label.\n\n` +
    `_The fix agent never merges and never relaxes CI; it only proposes fixes on the PR ` +
    `branch. simulated=${hasKey ? 'false' : 'true (advisory only, no code changed)'}._`
  );
}

// ── No key: honest advisory no-op, GREEN. ────────────────────────────────────
if (!hasKey) {
  log('no key present, fixer in advisory mode — posting diagnosis, changing no code.');
  log('simulated=true (advisory only; no model invoked, no commit made).');
  postComment(prNumber, buildAdvisory());
  process.exit(0);
}

// ── Fork PRs never get secrets; stay advisory even if a key leaked into env. ──
if (isFork) {
  log('fork PR — secrets are not available to forks; staying advisory-only.');
  log('simulated=true (advisory only; a fork PR never receives the key).');
  postComment(prNumber, buildAdvisory());
  process.exit(0);
}

if (!headRef) {
  log('INFRASTRUCTURE: GH_PR_HEAD_REF not set; cannot commit a fix safely. (CI red gates)');
  process.exit(2);
}

// ── Live, model-backed, BOUNDED fix path. ────────────────────────────────────
// Gather the signal the model needs: the list of changed files (to enforce the sensitive
// refusal BEFORE asking for a fix) and a compact diff.
let changedFiles = [];
try {
  // origin/main is the base; the workflow fetches it.
  const out = git(['diff', '--name-only', 'origin/main...HEAD']);
  changedFiles = out ? out.split('\n').filter(Boolean) : [];
} catch (err) {
  log(`INFRASTRUCTURE: could not list changed files: ${err?.message ?? err}`);
  process.exit(2);
}

const touchesSensitive = changedFiles.some(isSensitive);
if (touchesSensitive) {
  log('PR touches enforcement/sensitive paths — the fixer REFUSES to edit these.');
  postComment(
    prNumber,
    `**agent-fix: refusing — enforcement paths.**\n\n` +
      `This PR changes enforcement/sensitive files (e.g. validator/orchestrator/policy, ` +
      `boundary-check, dep-hygiene, workflows, apps foundation, LICENSE, or secrets). ` +
      `The self-healing fixer will **never** edit these, because that would weaken the gate ` +
      `it exists to protect.\n\n` +
      `A human must review and add the \`human-approved\` label. CI stays the gate; nothing ` +
      `merges while \`${failedWf}\` is red.\n\n_simulated=false (no fix attempted; refused by policy)._`,
  );
  process.exit(0);
}

function diffForModel() {
  try {
    const d = git(['diff', 'origin/main...HEAD']);
    return d.slice(0, 150_000);
  } catch {
    return '';
  }
}

const AGENT_INSTRUCTIONS =
  'You are a bounded CI fix agent for a TypeScript/React monorepo. A PR has failing ' +
  'checks. Propose the SMALLEST patch that makes CI (typecheck, lint, test, build) pass. ' +
  'You MUST NOT edit any enforcement/sensitive file (validator.ts, orchestrator.ts, ' +
  'policy.ts, scripts/boundary-check.mjs, scripts/dep-hygiene.mjs, apps/**/foundation/**, ' +
  '.github/workflows/**, anything matching broker/LICENSE/secret/credential/.env). ' +
  'You MUST NOT weaken, delete, or skip tests, lint rules, or type checks to go green. ' +
  'Return ONLY a unified diff (git apply format) on the last fenced block of your reply, ' +
  'or the literal text NO_SAFE_FIX if no safe minimal fix exists.';

async function callModel(diff) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: AGENT_INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content:
            `The \`${failedWf}\` checks failed. Here is the PR diff against main.\n\n` +
            '--- BEGIN PR DIFF ---\n' +
            diff +
            '\n--- END PR DIFF ---',
        },
      ],
    }),
  });
  if (!resp.ok) {
    throw Object.assign(new Error(`model API returned HTTP ${resp.status}`), {
      kind: resp.status === 401 || resp.status === 403 ? 'auth' : 'http',
    });
  }
  const data = await resp.json();
  return (data?.content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Extract a unified diff from a fenced code block (``` ... ```), else null. */
function extractDiff(text) {
  if (/\bNO_SAFE_FIX\b/.test(text)) return null;
  const fence = text.match(/```(?:diff|patch)?\s*\n([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  // A usable patch must contain at least one hunk header.
  if (!/^@@ /m.test(body) && !/^diff --git /m.test(body)) return null;
  return body.endsWith('\n') ? body : body + '\n';
}

async function main() {
  log(`invoking model-backed fixer (model=${MODEL}). simulated=false`);
  const diff = diffForModel();
  if (!diff.trim()) {
    log('INFRASTRUCTURE: empty diff; nothing to analyze. (CI red gates)');
    process.exit(2);
  }

  let text;
  try {
    text = await callModel(diff);
  } catch (err) {
    const kind = err?.kind ? ` [${err.kind}]` : '';
    log(`INFRASTRUCTURE: model call failed${kind}: ${err?.message ?? err}`);
    // Never block merge on our own plumbing; never fake a fix.
    process.exit(2);
  }

  const patch = extractDiff(text);
  if (!patch) {
    log('model found NO safe minimal fix — leaving the PR red for a human.');
    postComment(
      prNumber,
      `**agent-fix: no safe automatic fix.**\n\n` +
        `The fixer analyzed the failing \`${failedWf}\` checks and did not find a safe, ` +
        `minimal fix it could apply without weakening enforcement or tests. Leaving the PR ` +
        `red for a human.\n\n_simulated=false._`,
    );
    process.exit(0);
  }

  // Apply the patch to a scratch file and git apply; validate it does not escape the
  // sensitive set after the fact (defense in depth over the model's instructions).
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const tmp = mkdtempSync(join(tmpdir(), 'agent-fix-'));
  const patchFile = join(tmp, 'fix.patch');
  writeFileSync(patchFile, patch, 'utf8');

  try {
    git(['apply', '--check', patchFile]);
  } catch (err) {
    log(`model patch did not apply cleanly: ${err?.message ?? err}. Leaving PR for a human.`);
    postComment(
      prNumber,
      `**agent-fix: proposed patch did not apply.**\n\n` +
        `The fixer produced a candidate patch but it did not apply cleanly to the branch. ` +
        `Leaving the PR red for a human.\n\n_simulated=false._`,
    );
    process.exit(0);
  }

  git(['apply', patchFile]);

  // Post-apply sensitive-path guard: refuse if the applied change touched a sensitive file.
  const nowChanged = git(['diff', '--name-only']).split('\n').filter(Boolean);
  if (nowChanged.some(isSensitive)) {
    log('applied patch touched a sensitive path — reverting and refusing.');
    git(['checkout', '--', '.']);
    postComment(
      prNumber,
      `**agent-fix: refused — patch touched enforcement paths.**\n\n` +
        `The candidate fix would have modified an enforcement/sensitive file. The fixer ` +
        `reverted it and refuses. A human with the \`human-approved\` label is needed.\n\n` +
        `_simulated=false._`,
    );
    process.exit(0);
  }

  // Commit on the PR branch, clearly agent-authored, unsigned (sandbox has no signer).
  git(['add', '-A']);
  git([
    'commit',
    '--no-gpg-sign',
    '-m',
    `fix(agent): bounded auto-fix for failing ${failedWf} (attempt ${attempts + 1}/${MAX_ATTEMPTS})`,
  ]);
  log(`committed fix (attempt ${attempts + 1}/${MAX_ATTEMPTS}).`);

  // Push to the PR head branch — this re-triggers CI via pull_request synchronize.
  try {
    git(['push', 'origin', `HEAD:${headRef}`]);
  } catch (err) {
    log(`INFRASTRUCTURE: push failed: ${err?.message ?? err}`);
    process.exit(2);
  }

  addLabel(prNumber, 'agent-fixed');
  postComment(
    prNumber,
    `**agent-fix: applied a bounded fix (attempt ${attempts + 1}/${MAX_ATTEMPTS}).**\n\n` +
      `A \`fix(agent):\` commit was pushed to this PR branch and CI will re-run. This is a ` +
      `REAL model-backed fix, not a simulation. The fixer did not touch any enforcement path ` +
      `and cannot merge or relax CI — \`verify\` must go green on its own.\n\n_simulated=false._`,
  );
  log('done — fix pushed; CI re-runs via synchronize. simulated=false.');
  process.exit(0);
}

main().catch((err) => {
  log(`INFRASTRUCTURE: unexpected error: ${err?.message ?? err}`);
  process.exit(2);
});

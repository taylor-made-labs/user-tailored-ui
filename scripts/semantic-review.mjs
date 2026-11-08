#!/usr/bin/env node
/**
 * SEMANTIC review layer — the model-backed half of the customization-boundary review.
 *
 * This runs the committed `customization-boundary-reviewer` agent
 * (.kiro/agents/customization-boundary-reviewer.json) against a PR diff and emits a
 * structured verdict. It sits ON TOP of the deterministic floor (scripts/boundary-check.mjs),
 * never replacing it. The floor is a HARD FLOOR: this layer can turn a floor PASS into a
 * BLOCK, but it can NEVER turn a floor FAILURE into success (CI/the workflow enforce that).
 *
 * HONESTY (steering 50-kiro-workflow, invariant 7):
 *   - When NO key is present, this script does NOTHING and exits 0 with a clear log line.
 *     It never fabricates a "the AI reviewed it and passed" result. The caller (the
 *     workflow) then reflects the DETERMINISTIC FLOOR result only — exactly as before.
 *   - When a key IS present, it makes a REAL model call. A real PASS/FAIL is reported.
 *   - It prints `simulated=true|false` so no simulated result is ever mistaken for real.
 *
 * SECURITY:
 *   - The key is read from the environment (ANTHROPIC_API_KEY), which the workflow wires
 *     from GitHub Actions secrets. It is NEVER printed, logged, or written anywhere.
 *   - Fork PRs do not receive secrets (the workflow keeps the default `pull_request`
 *     event), so on a fork PR this script simply takes the no-key path.
 *
 * Exit codes:
 *   0  = PASS            (no blocker; or no-key skip; the floor still gates independently)
 *   1  = FAIL / BLOCK    (model returned verdict FAIL or any blocker finding)
 *   2  = INFRASTRUCTURE  (could not run the model; treated by the workflow as non-fatal
 *                         so the deterministic floor still decides — we never block merge
 *                         on our own plumbing failing, and we never fake a PASS either)
 *
 * Usage: node scripts/semantic-review.mjs <diff-file>
 *   <diff-file> is a unified diff of the PR (base...head). If omitted or empty, the
 *   script takes the infrastructure path (exit 2) rather than reviewing nothing.
 */
import { readFileSync } from 'node:fs';

const AGENT_PATH = '.kiro/agents/customization-boundary-reviewer.json';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// Default model. Kept deliberately small/cheap; overridable via SEMANTIC_REVIEW_MODEL.
const MODEL = process.env.SEMANTIC_REVIEW_MODEL || 'claude-haiku-4-5';
const MAX_TOKENS = 2048;
const MAX_DIFF_CHARS = 180_000; // keep the request well inside context limits

const hasKey = !!process.env.ANTHROPIC_API_KEY;

function log(msg) {
  console.log(`[semantic-review] ${msg}`);
}

// ── No-key path: honest degrade to deterministic-floor-only. ────────────────
if (!hasKey) {
  log('no key present, deterministic floor only — skipping model-backed review.');
  log('simulated=false (no model was invoked; the agent-review status reflects the floor).');
  process.exit(0);
}

// ── Key present: run the REAL model-backed review. ──────────────────────────
const diffFile = process.argv[2];
if (!diffFile) {
  log('INFRASTRUCTURE: no diff file argument given; cannot review. (floor still gates)');
  process.exit(2);
}

let diff;
try {
  diff = readFileSync(diffFile, 'utf8');
} catch (err) {
  log(`INFRASTRUCTURE: could not read diff file "${diffFile}": ${err?.message ?? err}`);
  process.exit(2);
}

if (!diff.trim()) {
  log('INFRASTRUCTURE: diff is empty; nothing to review. (floor still gates)');
  process.exit(2);
}

if (diff.length > MAX_DIFF_CHARS) {
  log(`diff is large (${diff.length} chars); truncating to ${MAX_DIFF_CHARS} for the review.`);
  diff = diff.slice(0, MAX_DIFF_CHARS) + '\n\n[...diff truncated for length...]';
}

// Load the committed reviewer agent so the SAME prompt/invariants are used that the repo
// ships. We do not re-author the review criteria here — single source of truth.
let agent;
try {
  agent = JSON.parse(readFileSync(AGENT_PATH, 'utf8'));
} catch (err) {
  log(`INFRASTRUCTURE: could not read agent file "${AGENT_PATH}": ${err?.message ?? err}`);
  process.exit(2);
}

const systemPrompt = agent.prompt;
if (!systemPrompt || typeof systemPrompt !== 'string') {
  log('INFRASTRUCTURE: agent file has no usable prompt.');
  process.exit(2);
}

const userContent =
  'Review the following PR diff against the invariants. Output ONLY the required JSON ' +
  'object on the last line of your response.\n\n' +
  '--- BEGIN PR DIFF ---\n' +
  diff +
  '\n--- END PR DIFF ---';

/** Call the Anthropic Messages API. Never logs the key. */
async function callModel() {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!resp.ok) {
    // Do NOT echo response bodies that could conceivably include request detail; a status
    // code is enough and never contains the key.
    throw Object.assign(new Error(`model API returned HTTP ${resp.status}`), {
      kind: resp.status === 401 || resp.status === 403 ? 'auth' : 'http',
    });
  }
  const data = await resp.json();
  const text = (data?.content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('\n');
  if (!text.trim()) throw new Error('model returned no text content');
  return text;
}

/** Extract the last JSON object from the model's text output. */
function parseVerdict(text) {
  // The agent is instructed to put the JSON on the LAST line. Be tolerant: scan from the
  // end for the last balanced {...} block.
  const lastBrace = text.lastIndexOf('{');
  if (lastBrace === -1) throw new Error('no JSON object found in model output');
  const candidate = text.slice(lastBrace);
  // Walk to the matching close brace.
  let depth = 0;
  let end = -1;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] === '{') depth++;
    else if (candidate[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error('unbalanced JSON object in model output');
  return JSON.parse(candidate.slice(0, end + 1));
}

async function main() {
  log(`invoking model-backed review (model=${MODEL}). simulated=false`);
  let text;
  try {
    text = await callModel();
  } catch (err) {
    const kind = err?.kind ? ` [${err.kind}]` : '';
    log(`INFRASTRUCTURE: model call failed${kind}: ${err?.message ?? err}`);
    // Never block merge on our own plumbing failing; never fake a PASS. The deterministic
    // floor remains the gate.
    process.exit(2);
  }

  let verdict;
  try {
    verdict = parseVerdict(text);
  } catch (err) {
    log(`INFRASTRUCTURE: could not parse model verdict: ${err?.message ?? err}`);
    process.exit(2);
  }

  const findings = Array.isArray(verdict.findings) ? verdict.findings : [];
  const blockers = findings.filter((f) => f?.severity === 'blocker');
  const isFail = verdict.verdict === 'FAIL' || blockers.length > 0;

  log(`verdict=${verdict.verdict} requiresHumanApproval=${!!verdict.requiresHumanApproval} ` +
    `findings=${findings.length} blockers=${blockers.length} simulated=false`);
  if (verdict.summary) log(`summary: ${verdict.summary}`);
  for (const f of findings) {
    log(`  [${(f.severity || '?').toUpperCase()}] ${f.invariant || '?'} :: ${f.file || '?'} — ${f.detail || ''}`);
  }

  if (isFail) {
    log('BLOCK — semantic review returned FAIL or a blocker finding.');
    process.exit(1);
  }
  log('PASS — semantic review found no blocker (floor still gates independently).');
  process.exit(0);
}

main().catch((err) => {
  log(`INFRASTRUCTURE: unexpected error: ${err?.message ?? err}`);
  process.exit(2);
});

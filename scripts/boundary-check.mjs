#!/usr/bin/env node
/**
 * Deterministic boundary guardrails — the static, model-free subset of the
 * customization-boundary review. Runs in CI with no secrets and no network.
 *
 * This is NOT a substitute for the full LLM review by the
 * `customization-boundary-reviewer` agent; it is the always-on, deterministic floor
 * that can never be skipped. The agent layer adds semantic judgment on top. Being
 * honest about this split matters (steering 50-kiro-workflow): CI enforces what can be
 * checked mechanically; the agent handles the rest; neither can relax CI.
 *
 * Exit 0 = pass, 1 = blocker(s) found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const findings = [];

/** Recursively collect source files we care about. */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    // Skip deps/build artifacts and documentation/config trees. `.kiro/` holds specs,
    // steering, and agent prompts that legitimately *describe* forbidden patterns as
    // prose; scanning them would false-positive. This checker targets executable
    // product source (src/, apps/, scripts/, workflows handled separately).
    if (['node_modules', '.git', 'dist', 'coverage', '.kiro', '.github'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);

function add(severity, invariant, file, detail) {
  findings.push({ severity, invariant, file: file.replace(ROOT + '/', ''), detail });
}

for (const file of files) {
  const ext = extname(file);
  if (!['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'].includes(ext)) continue;
  // Skip this checker and tests that legitimately reference forbidden patterns as strings.
  if (file.endsWith('boundary-check.mjs')) continue;
  const text = readFileSync(file, 'utf8');
  const isTest = /\.test\.|[\\/]test[\\/]/.test(file);

  // 1. No eval / Function constructor / dynamic code execution.
  if (/\beval\s*\(/.test(text) || /new\s+Function\s*\(/.test(text)) {
    add('blocker', 'no-generated-code-execution', file, 'eval/Function constructor present');
  }

  // 2. Storage: no localStorage / chrome.storage in product code.
  if (!isTest && /\blocalStorage\b/.test(text)) {
    add('blocker', 'indexeddb-only', file, 'localStorage used (IndexedDB only)');
  }
  if (!isTest && /\bchrome\.storage\b/.test(text)) {
    add('blocker', 'indexeddb-only', file, 'chrome.storage used (IndexedDB only)');
  }

  // 3. No committed secrets (very common key shapes).
  if (/sk-ant-[A-Za-z0-9_-]{8,}/.test(text) || /\bAKIA[0-9A-Z]{16}\b/.test(text)) {
    add('blocker', 'no-committed-secrets', file, 'looks like a committed API key');
  }
  // Runtime CDN script injection (MV3 constraint) — flag obvious cases.
  if (/https?:\/\/[^"']*\.js["']\s*\)?\s*;?\s*\/\/\s*cdn/i.test(text)) {
    add('warn', 'mv3-no-runtime-cdn', file, 'possible runtime CDN code reference');
  }
}

// Output machine- and human-readable results.
const blockers = findings.filter((f) => f.severity === 'blocker');
for (const f of findings) {
  const tag = f.severity.toUpperCase();
  console.log(`[${tag}] ${f.invariant} :: ${f.file} — ${f.detail}`);
}
console.log(`\nboundary-check: ${findings.length} finding(s), ${blockers.length} blocker(s).`);
process.exit(blockers.length > 0 ? 1 : 0);

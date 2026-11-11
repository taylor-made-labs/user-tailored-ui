#!/usr/bin/env node
/**
 * vendored-parity — mechanical replacement for the old "apps/**\/foundation/** needs a
 * human label" path hold.
 *
 * Every file under apps/<app>/src/foundation/ must be an unchanged copy of its reviewed
 * source in src/ (same relative path). "Unchanged" = identical after dropping comments and
 * formatting (parsed with the TypeScript printer, types kept), because the existing copies
 * are comment-stripped. Any code difference, or a foundation file with no source in src/,
 * fails CI. A matching copy therefore carries no new reviewable code.
 *
 * Usage: node scripts/vendored-parity.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

export function normalize(text, name = 'x.ts') {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const out = ts.createPrinter({ removeComments: true }).printFile(sf);
  // shortcut: trailing commas are dropped by regex (the copies were reformatted by prettier);
  // a change confined to a ",}"-like sequence inside a string literal would go unnoticed.
  // Upgrade: strip them from the AST instead.
  return out.replace(/\s*,?\s*([)}\]])/g, '$1');
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Returns a list of problem strings (empty = all copies match). */
export function checkParity(root) {
  const problems = [];
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return problems;
  for (const app of readdirSync(appsDir)) {
    const fdir = join(appsDir, app, 'src', 'foundation');
    if (!existsSync(fdir)) continue;
    for (const file of walk(fdir)) {
      const rel = relative(fdir, file);
      const src = join(root, 'src', rel);
      const shown = relative(root, file);
      if (!existsSync(src)) {
        problems.push(`${shown}: no reviewed source at src/${rel}`);
        continue;
      }
      const a = normalize(readFileSync(src, 'utf8'), src);
      const b = normalize(readFileSync(file, 'utf8'), file);
      if (a !== b) problems.push(`${shown}: differs from src/${rel}`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const problems = checkParity(process.cwd());
  if (problems.length) {
    console.error('vendored-parity FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log('vendored-parity OK: all apps/*/src/foundation copies match src/.');
}

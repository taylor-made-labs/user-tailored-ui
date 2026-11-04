#!/usr/bin/env node
// dependency-hygiene check — part of the pre-agent static-analysis layer.
//
// Deterministic, keyless, zero-model-cost gate run inside the CI `verify` job.
// Two hard checks that FAIL the build, and one best-effort advisory scan that
// NEVER fails the build and degrades gracefully offline:
//
//   HARD (fail):
//     (a) every dependency / devDependency / optionalDependency version must be
//         an EXACT pinned version — no ^, ~, >=, <=, >, <, *, x-ranges, `latest`,
//         ` - ` ranges, `||` unions, or git/url/file/workspace specifiers.
//         The repo convention is exact pins + a committed lockfile.
//     (b) package-lock.json must exist (committed lockfile).
//
//   BEST-EFFORT (never fails the build):
//     (c) `npm audit --audit-level=high --json` for known high/critical advisories.
//         A network failure or absent registry is treated as a SKIP with a clear
//         "advisory scan skipped (offline)" log line — it is advisory only.
//
// Node ESM, no new dependencies. Run from the repo root: `node scripts/dep-hygiene.mjs`.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const log = (msg) => console.log(`dep-hygiene: ${msg}`);
const errors = [];

// A version string is an acceptable EXACT pin only if it is a bare semver, with an
// optional pre-release / build-metadata tail. Everything else (ranges, wildcards,
// tags, git/url/file/workspace protocols) is rejected.
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function checkPins(pkg) {
  const groups = ['dependencies', 'devDependencies', 'optionalDependencies'];
  for (const group of groups) {
    const deps = pkg[group];
    if (!deps) continue;
    for (const [name, rawSpec] of Object.entries(deps)) {
      const spec = String(rawSpec).trim();
      if (!EXACT_SEMVER.test(spec)) {
        errors.push(
          `unpinned ${group} entry: "${name}": "${spec}" — must be an exact version ` +
            `(no ^, ~, >=, *, "latest", ranges, or git/url/file/workspace specs)`,
        );
      }
    }
  }
}

// --- (a) + (b): hard checks on the root package.json ---------------------------
const pkgPath = join(repoRoot, 'package.json');
if (!existsSync(pkgPath)) {
  errors.push('package.json not found at repo root');
} else {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  checkPins(pkg);
}

const lockPath = join(repoRoot, 'package-lock.json');
if (!existsSync(lockPath)) {
  errors.push('package-lock.json is missing — a committed lockfile is required');
} else {
  log('committed lockfile present (package-lock.json)');
}

// Note: the vendored demo apps under apps/* carry their OWN package.json +
// package-lock.json and are hygiene-checked within their own CI matrix job, not here.
log('scope: foundation root package.json (apps/* manage their own deps)');

// --- (c): best-effort advisory scan (NEVER fails the build) --------------------
log('advisory scan is BEST-EFFORT only — it never fails the build');
try {
  const res = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });

  if (res.error) {
    // spawn failed entirely (e.g. ENOENT / timeout) — treat as offline skip.
    log(`advisory scan skipped (offline): ${res.error.code || res.error.message}`);
  } else {
    let report = null;
    try {
      report = JSON.parse(res.stdout || '{}');
    } catch {
      report = null;
    }

    // npm audit without a reachable registry emits an error object rather than a
    // vulnerabilities report. Detect that and skip rather than fail.
    const reachedRegistry = report && typeof report === 'object' && 'metadata' in report;
    if (!reachedRegistry) {
      log('advisory scan skipped (offline): registry unreachable or no audit data');
    } else {
      const vulns = report.metadata?.vulnerabilities ?? {};
      const high = vulns.high ?? 0;
      const critical = vulns.critical ?? 0;
      if (high + critical > 0) {
        // Best-effort: surface loudly as a warning but DO NOT fail the build.
        log(
          `WARNING (advisory, non-blocking): ${critical} critical + ${high} high ` +
            `advisories reported by npm audit. Review them, but this gate does not block.`,
        );
      } else {
        log('advisory scan: no high/critical advisories reported');
      }
    }
  }
} catch (e) {
  log(`advisory scan skipped (offline): ${e?.message ?? e}`);
}

// --- verdict -------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`\ndep-hygiene: FAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

log('OK — all dependencies exact-pinned and lockfile present.');

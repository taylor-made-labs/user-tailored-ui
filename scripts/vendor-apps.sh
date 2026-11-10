#!/usr/bin/env bash
#
# vendor-apps.sh — reproduce (or update) the vendored runnable app copies under apps/.
#
# The Skeleton Crew submission requires BOTH applications to live as reproducible,
# runnable copies in separate folders inside this repo. The authoritative source for
# each app is its own public repo; this script copies a specific commit of each app's
# runnable tree into apps/<app>/ so a fresh clone of THIS repo builds and tests both
# apps with no access to the source repos.
#
# It never deletes anything in apps/<app>/ and skips the KEEP_LIST of app-owned files.
# It is deliberately simple and deterministic: clone the pinned commit, copy the
# runnable tree, drop only non-runtime infra (.git, node_modules, dist, the app's own
# CI workflow and its LICENSE/.env files — see "What is excluded" below).
#
# Usage:
#   scripts/vendor-apps.sh                 # re-vendor both apps at the pinned SHAs below
#   PLANNER_REF=<sha|branch> scripts/vendor-apps.sh   # override the planner source ref
#   INVENTORY_REF=<sha|branch> scripts/vendor-apps.sh # override the inventory source ref
#
# After running, review `git status`, commit the result, and open a PR. CI
# (.github/workflows/ci.yml, job "apps") then runs `npm ci && typecheck && lint &&
# test && build` in each apps/<app>/ directory to prove the copies are runnable.
#
# -----------------------------------------------------------------------------------
# Pinned sources (UPDATE these two lines when re-vendoring from a newer commit):
#
#   Planner   : https://github.com/taylor-made-labs/user-tailored-planner
#               ref feat/planner-slice @ 94e0fbe9e82c6bba9880f0a0c42caa356e082b36
#               (the full vertical slice — the app's own main currently holds only the
#               scaffold; the slice branch is the accepted, CI-green runnable app.)
#   Inventory : https://github.com/taylor-made-labs/user-tailored-inventory
#               ref main @ 0ec29fa3c7c1842aa90356b3b292aea085052aa4
#
# What is excluded from each copy, and why:
#   .git, node_modules, dist   — VCS metadata / build artifacts / installed deps.
#   .github/                   — the app's own CI. GitHub only runs workflows from the
#                                repo-root .github/; a nested copy would never execute
#                                and would only mislead. THIS repo's root CI (job "apps")
#                                is what verifies the copies.
#   LICENSE-MIT, LICENSE-APACHE, .env.example
#                              — this repo is dual-licensed at the root (LICENSE-MIT,
#                                LICENSE-APACHE, NOTICE) covering the whole tree; the
#                                apps carry the same "MIT OR Apache-2.0" in their
#                                package.json. The .env.example is a secrets template not
#                                needed for the deterministic (test-double) CI build.
#
# Everything required to build/test each app on its own IS copied: src/, test/,
# package.json, package-lock.json, tsconfig, vite/vitest config, index.html, and the
# app's public .kiro/ (specs + steering — tracked dev evidence for judges).
# -----------------------------------------------------------------------------------
set -euo pipefail

PLANNER_REPO="https://github.com/taylor-made-labs/user-tailored-planner.git"
INVENTORY_REPO="https://github.com/taylor-made-labs/user-tailored-inventory.git"

PLANNER_REF="${PLANNER_REF:-94e0fbe9e82c6bba9880f0a0c42caa356e082b36}"
INVENTORY_REF="${INVENTORY_REF:-0ec29fa3c7c1842aa90356b3b292aea085052aa4}"

# Resolve this repo's root (the script lives in <root>/scripts/).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

RSYNC_EXCLUDES=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='dist'
  --exclude='.github'
  --exclude='LICENSE-MIT'
  --exclude='LICENSE-APACHE'
  --exclude='.env.example'
)

# App-owned files: wiring this repo added AFTER vendoring (browser-repos history adapter,
# its dependency, its tests, and the files that import it). They never exist in the pinned
# source, or differ from it on purpose, so a re-vendor must not touch them. Anchored with
# a leading / so only the app-root path matches. Add a line here for every new app-owned file.
# shortcut: package.json / package-lock.json are kept, so upstream dependency changes are
# not pulled in automatically; merge them by hand. Upgrade: the workspace package (A17).
KEEP_LIST=(
  --exclude='/vendor/'
  --exclude='/creator-policy.json'
  --exclude='/package.json'
  --exclude='/package-lock.json'
  --exclude='/README.md'
  --exclude='/src/foundation/'
  --exclude='/src/main.tsx'
  --exclude='/src/App.tsx'
  --exclude='/src/customization/service.ts'
  --exclude='/vitest.config.ts'
  --exclude='/test/setup.ts'
  --exclude='/test/history-persistence.test.ts'
  --exclude='/test/browser-repos-pin.test.ts'
)

vendor_one() {
  local name="$1" repo="$2" ref="$3"
  echo ">> Vendoring '$name' from $repo @ $ref"
  git clone --quiet "$repo" "$TMP/$name"
  git -C "$TMP/$name" checkout --quiet "$ref"
  local sha; sha="$(git -C "$TMP/$name" rev-parse HEAD)"
  local dest="$REPO_ROOT/apps/$name"
  mkdir -p "$dest"
  # No --delete and no rm: files that exist only here (app-owned wiring) are never removed.
  rsync -a "${RSYNC_EXCLUDES[@]}" "${KEEP_LIST[@]}" "$TMP/$name/" "$dest/"
  echo "   copied to apps/$name/ (source commit $sha)"
}

vendor_one planner   "$PLANNER_REPO"   "$PLANNER_REF"
vendor_one inventory "$INVENTORY_REPO" "$INVENTORY_REF"

echo
echo "Done. Review changes with: git -C \"$REPO_ROOT\" status"
echo "Then commit the lockfiles and open a PR; CI job \"apps\" verifies each copy."

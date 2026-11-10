#!/usr/bin/env bash
#
# pack-browser-repos.sh — build the vendored browser-repos tarball from a browser-repos
# checkout (default: origin/main). browser-repos is private/unpublished and its own
# package.json has no main/exports/files, so we stage a consumable package around its
# compiled dist/ (same shape the apps have always used) and `npm pack` it.
#
# Usage: scripts/pack-browser-repos.sh [ref]        # ref defaults to origin/main
# Then: copy the .tgz to apps/*/vendor/, update each apps/*/package-lock.json
# "integrity" (printed below), and record the SHA in each app README.
set -euo pipefail

REPO="https://github.com/taylor-made-labs/browser-repos.git"
REF="${1:-main}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"

git clone --quiet "$REPO" "$TMP/src"
git -C "$TMP/src" checkout --quiet "$REF"
SHA="$(git -C "$TMP/src" rev-parse HEAD)"
(cd "$TMP/src" && npm ci --no-audit --no-fund --ignore-scripts >/dev/null && npm run build >/dev/null)

mkdir -p "$TMP/pkg"
cp -r "$TMP/src/dist" "$TMP/pkg/dist"
cp "$TMP/src"/{LICENSE-MIT,LICENSE-APACHE,NOTICE,README.md} "$TMP/pkg/"
node -e '
const fs = require("fs");
const src = JSON.parse(fs.readFileSync(process.argv[1] + "/package.json", "utf8"));
const pkg = {
  name: src.name, version: src.version,
  description: src.description + " Compiled distribution packaged as a pinned file: dependency; built from browser-repos @ " + process.argv[2] + ".",
  license: src.license, type: "module", engines: src.engines,
  main: "./dist/index.js", module: "./dist/index.js", types: "./dist/index.d.ts",
  exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" } },
  files: ["dist", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "README.md"],
  dependencies: src.dependencies,
};
fs.writeFileSync(process.argv[3] + "/package.json", JSON.stringify(pkg, null, 2) + "\n");
' "$TMP/src" "$SHA" "$TMP/pkg"

(cd "$TMP/pkg" && npm pack --pack-destination "$TMP" --silent >/dev/null)
OUT="$TMP/taylor-made-labs-browser-repos-0.1.0.tgz"
echo "browser-repos @ $SHA"
echo "tarball: $OUT"
echo "integrity: sha512-$(openssl dgst -sha512 -binary "$OUT" | base64 -w0)"

# Contributing

User-Tailored Inventory is the second app adopting the `user-tailored-ui` foundation
for the Kiroween 2026 Skeleton Crew category. A few conventions keep the flywheel
honest.

## The port boundary is non-negotiable

All foundation code — types, the orchestrator, ports, the labeled test-double
adapters — is imported from the single seam `src/ports/foundation.ts` and nowhere
else. Never import from `src/foundation/**` directly, and never reach into a
foundation internal module. When the foundation publishes to npm, that one file
re-points at the pinned package and `src/foundation/` is deleted; no other app code
changes.

If something has to be re-solved here that the foundation should really own, note the
friction in the PR rather than growing new app-side internals — that signal is the
point of building a second adopter.

## Architecture

Hexagonal. The domain (`src/domain/item.ts`) is pure: no React, no model, no storage.
The model's output is treated as **data**, never executed — no `eval`. User requests
and model proposals are untrusted and are validated against the `CreatorPolicy` before
every activation; a rejection cites the failed invariant and the last valid view is
kept.

## Storage

Business items live in **IndexedDB only** — never localStorage, never chrome.storage —
and in a store kept strictly separate from customization history.

## Verification

Author and commit in the sandbox; GitHub Actions CI is the source of truth for "it
runs". Before opening a PR, locally:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs the same sequence and must be green. No secrets, no network beyond npm: the
default inference adapter is the labeled offline test-double. Never commit a key or
token; `.env` is gitignored while `.env.example` documents the shape.

Pin exact dependency versions (no `^`/`~`) and commit the lockfile. TypeScript runs in
`strict` mode — two traps worth remembering: discriminate unions on a distinguishing
field rather than a shared `ok: true`, and under `exactOptionalPropertyTypes` build
objects conditionally instead of assigning `undefined` to an optional property.

`.kiro/` is tracked and public (judges must see specs, steering, and development
evidence in a fresh clone) — never gitignore it.

## License

Dual-licensed `MIT OR Apache-2.0`. Contributions are accepted under the same terms.

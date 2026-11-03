/**
 * The SINGLE foundation seam for the Inventory app.
 *
 * All Inventory code imports foundation types, the orchestrator, the ports, and the
 * labeled test-double adapters from HERE — never from `src/foundation/**` directly,
 * and never from any foundation internal module. This is the port boundary required
 * by the steering (`.kiro/steering` in the foundation repo): the foundation is
 * consumed through its public exports only.
 *
 * Consumption method (documented in the PR body): the foundation
 * (`@taylor-made-labs/user-tailored-ui`) is NOT yet published to npm, and CI runs
 * `npm ci` in an isolated runner with no access to the sibling checkout, so a
 * `file:` dependency cannot resolve there. We therefore VENDOR ONLY the foundation's
 * public entrypoint (`src/foundation/`, a faithful copy of the foundation's own
 * `src/index.ts` and the modules it re-exports) and re-export it through this one
 * file. When the foundation publishes, this file becomes:
 *
 *     export * from '@taylor-made-labs/user-tailored-ui';
 *
 * and `src/foundation/` is deleted — no other Inventory source changes.
 */

export * from '../foundation/index.js';

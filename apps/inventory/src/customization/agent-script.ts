/**
 * The DEFAULT (offline, labeled) agent script for the Inventory app.
 *
 * This drives the foundation's `TestDoubleInferenceAdapter`: deterministic,
 * keyword-matched proposals with NO network and NO secrets. It always reports
 * `simulated: true` / `providerId: "test-double"`, so the UI labels its output as
 * simulated and never presents it as a real model result.
 *
 * A real model adapter is a later gated step and is injected through the SAME
 * inference port with zero Inventory code change — no key is wired here.
 */

import type { TestDoubleScript } from '../ports/foundation.js';
import { lowStockFocusProposal, violationProposals } from './views.js';

/**
 * Keyword rules, first match wins. "low stock"/"restock"/"reorder"/"focus" produce
 * the valid low-stock focus transform; the explicit demo phrases produce each
 * violation fixture so a judge can trigger a rejection from the UI. Anything else
 * falls back to a no-op proposal (returns the current view unchanged).
 */
export const inventoryAgentScript: TestDoubleScript = {
  rules: [
    ['remove adjust', violationProposals['remove-adjust-control']],
    ['hide adjust', violationProposals['remove-adjust-control']],
    ['hide quantity', violationProposals['remove-adjust-control']],
    ['huge', violationProposals['font-scale-over-limit']],
    ['giant font', violationProposals['font-scale-over-limit']],
    ['kanban', violationProposals['non-approved-component']],
    ['archive', violationProposals['disallowed-action']],
    ['low stock', lowStockFocusProposal],
    ['restock', lowStockFocusProposal],
    ['reorder', lowStockFocusProposal],
    ['focus', lowStockFocusProposal],
  ],
  fallback: {},
};

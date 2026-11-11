/**
 * The DEFAULT (offline, labeled) agent script for the Planner (spec task 5, R6).
 *
 * This drives the foundation's `TestDoubleInferenceAdapter`: deterministic,
 * keyword-matched proposals with NO network and NO secrets. It always reports
 * `simulated: true` / `providerId: "test-double"`, so the UI labels its output as
 * simulated and never presents it as a real model result.
 *
 * The real Anthropic adapter is a later gated step and is injected through the SAME
 * inference port with zero Planner code change — no key is wired here.
 */

import type { TestDoubleScript } from '../ports/foundation.js';
import { agendaProposal, violationProposals } from './views.js';

/**
 * Keyword rules, first match wins. "agenda"/"focus"/"daily" produce the valid
 * agenda transform; the explicit demo phrases produce each violation fixture so a
 * judge can trigger a rejection from the UI. Anything else falls back to a no-op
 * proposal (returns the current view unchanged).
 */
export const plannerAgentScript: TestDoubleScript = {
  rules: [
    // Mixed request: one good part and one bad part (partial apply demo).
    ['mixed', { ...agendaProposal, tokens: { ...agendaProposal.tokens, fontScale: 3 } }],
    ['remove complete', violationProposals['remove-complete-control']],
    ['hide complete', violationProposals['remove-complete-control']],
    ['huge', violationProposals['font-scale-over-limit']],
    ['giant font', violationProposals['font-scale-over-limit']],
    ['banner', violationProposals['non-approved-component']],
    ['delete all', violationProposals['disallowed-action']],
    ['agenda', agendaProposal],
    ['focus', agendaProposal],
    ['daily', agendaProposal],
  ],
  fallback: {},
};

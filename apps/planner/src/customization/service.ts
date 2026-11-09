/**
 * Planner customization service (spec tasks 5 & 8; R3, R5, R6).
 *
 * Wires the foundation `CustomizationOrchestrator` with:
 *   - the Planner `CreatorPolicy`,
 *   - the labeled `TestDoubleInferenceAdapter` BY DEFAULT (offline, no key),
 *   - a `CustomizationHistoryStore`: the app (`main.tsx`) injects the real
 *     browser-repos / IndexedDB-git-backed store; the in-memory double is the
 *     fallback default here and is used by the deterministic Node tests.
 *
 * It exposes the enforced flow — propose -> preview -> apply/save -> reopen -> undo —
 * over a fixed user+app history scope, so the React layer stays thin. The inference
 * provider is injectable: swapping in the real Anthropic adapter needs NO change here
 * (port boundary). Business TASK data is never touched by any method here.
 */

import {
  CustomizationOrchestrator,
  InMemoryHistoryStore,
  TestDoubleInferenceAdapter,
  type CustomizationHistoryStore,
  type CustomizationProposal,
  type HistoryRef,
  type HistoryScope,
  type InferenceProvider,
  type ProposeOutcome,
  type ViewDescriptor,
} from '../ports/foundation.js';
import { plannerPolicy } from './policy.js';
import { defaultBoardView } from './views.js';
import { plannerAgentScript } from './agent-script.js';

export const PLANNER_APP_ID = 'user-tailored-planner';
export const PLANNER_APP_VERSION = '0.1.0';

export interface PlannerCustomizationDeps {
  readonly userId: string;
  /** Defaults to the labeled offline test-double agent. */
  readonly inference?: InferenceProvider;
  /** Defaults to the in-memory history double. */
  readonly history?: CustomizationHistoryStore;
  /** Injectable clock for deterministic tests. */
  readonly now?: () => string;
}

/** Outcome of applying a previewed view: either saved, or re-rejected by the recheck. */
export type ApplyOutcome =
  | { readonly ok: true; readonly view: ViewDescriptor }
  | Extract<ProposeOutcome, { ok: false }>;

export class PlannerCustomization {
  private readonly orchestrator: CustomizationOrchestrator;
  private readonly history: CustomizationHistoryStore;
  private readonly scope: HistoryScope;

  constructor(deps: PlannerCustomizationDeps) {
    const inference =
      deps.inference ?? new TestDoubleInferenceAdapter(plannerAgentScript);
    this.history = deps.history ?? new InMemoryHistoryStore();
    this.scope = { userId: deps.userId, appId: PLANNER_APP_ID };
    this.orchestrator = new CustomizationOrchestrator({
      policy: plannerPolicy,
      inference,
      history: this.history,
      appVersion: PLANNER_APP_VERSION,
      ...(deps.now ? { now: deps.now } : {}),
    });
  }

  /** History refs for the current user+app scope, newest-first (for the undo list). */
  listHistory(): Promise<readonly HistoryRef[]> {
    return this.history.list(this.scope);
  }

  /** The trusted shipped baseline view. */
  get defaults(): ViewDescriptor {
    return defaultBoardView;
  }

  /** request -> proposal -> validation -> preview (from a natural-language utterance). */
  proposeFromUtterance(base: ViewDescriptor, utterance: string): Promise<ProposeOutcome> {
    return this.orchestrator.proposeFromUtterance(base, utterance);
  }

  /** validation -> preview for an already-formed proposal (e.g. a direct preference edit). */
  previewProposal(
    base: ViewDescriptor,
    proposal: CustomizationProposal,
    meta: { simulated: boolean; providerId: string },
  ): ProposeOutcome {
    return this.orchestrator.previewProposal(base, proposal, meta);
  }

  /** apply -> save. Re-validates the view and records it in the user+app history. */
  async apply(
    base: ViewDescriptor,
    previewView: ViewDescriptor,
    message: string,
  ): Promise<ApplyOutcome> {
    const res = await this.orchestrator.applyAndSave(
      this.scope,
      base,
      previewView,
      message,
    );
    // applyAndSave returns `{ ok:true, view } | ProposeOutcome`. Both success arms
    // share `ok:true`, so discriminate on the presence of `view` vs `preview`.
    if (res.ok === false) {
      return res;
    }
    if ('view' in res) {
      return { ok: true, view: res.view };
    }
    // Unreachable in practice (a successful applyAndSave carries `view`), but keeps
    // the function total for the `{ ok:true, preview }` shape of the union.
    return { ok: true, view: res.preview.view };
  }

  /** reopen: load latest saved state, revalidated under the CURRENT policy. */
  reopen(): Promise<{ view: ViewDescriptor; usedFallback: boolean; staleAgainstPolicy: boolean }> {
    return this.orchestrator.reopen(this.scope, defaultBoardView);
  }

  /** undo/rollback to a prior history ref, revalidated under current policy. */
  undoTo(ref: string): Promise<{ view: ViewDescriptor; usedFallback: boolean } | null> {
    return this.orchestrator.undoTo(this.scope, ref, defaultBoardView);
  }
}

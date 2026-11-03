/**
 * Inventory customization service.
 *
 * Wires the foundation `CustomizationOrchestrator` with:
 *   - the Inventory `CreatorPolicy`,
 *   - the labeled `TestDoubleInferenceAdapter` BY DEFAULT (offline, no key),
 *   - a `CustomizationHistoryStore` (in-memory double by default; an IndexedDB-backed
 *     store is injectable later through the same port).
 *
 * It exposes the enforced flow — propose -> preview -> apply/save -> reopen -> undo —
 * over a fixed user+app history scope, so the React layer stays thin. The inference
 * provider is injectable: swapping in a real model adapter needs NO change here
 * (port boundary). Business ITEM data is never touched by any method here.
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
import { inventoryPolicy } from './policy.js';
import { defaultGridView } from './views.js';
import { inventoryAgentScript } from './agent-script.js';

export const INVENTORY_APP_ID = 'user-tailored-inventory';
export const INVENTORY_APP_VERSION = '0.1.0';

export interface InventoryCustomizationDeps {
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

export class InventoryCustomization {
  private readonly orchestrator: CustomizationOrchestrator;
  private readonly history: CustomizationHistoryStore;
  private readonly scope: HistoryScope;

  constructor(deps: InventoryCustomizationDeps) {
    const inference =
      deps.inference ?? new TestDoubleInferenceAdapter(inventoryAgentScript);
    this.history = deps.history ?? new InMemoryHistoryStore();
    this.scope = { userId: deps.userId, appId: INVENTORY_APP_ID };
    this.orchestrator = new CustomizationOrchestrator({
      policy: inventoryPolicy,
      inference,
      history: this.history,
      appVersion: INVENTORY_APP_VERSION,
      ...(deps.now ? { now: deps.now } : {}),
    });
  }

  /** History refs for the current user+app scope, newest-first (for the undo list). */
  listHistory(): Promise<readonly HistoryRef[]> {
    return this.history.list(this.scope);
  }

  /** The trusted shipped baseline view. */
  get defaults(): ViewDescriptor {
    return defaultGridView;
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
    return this.orchestrator.reopen(this.scope, defaultGridView);
  }

  /** undo/rollback to a prior history ref, revalidated under current policy. */
  undoTo(ref: string): Promise<{ view: ViewDescriptor; usedFallback: boolean } | null> {
    return this.orchestrator.undoTo(this.scope, ref, defaultGridView);
  }
}

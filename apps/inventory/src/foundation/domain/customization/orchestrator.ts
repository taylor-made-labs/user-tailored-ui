/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/domain/customization/orchestrator.ts).
 * Faithful copy of the foundation's orchestrator. Consumed behind a port.
 *
 * The single, thin spine of the enforced flow:
 *   request -> proposal -> validation -> preview -> apply -> save -> reopen -> undo
 */

import type { CreatorPolicy } from './policy.js';
import { validateProposal, type ValidationResult } from './validator.js';
import type { CustomizationProposal, ViewDescriptor } from './types.js';
import type { InferenceProvider, InferenceRequest } from '../../ports/inference.js';
import type {
  CustomizationHistoryStore,
  HistoryScope,
  SavedCustomization,
} from '../../ports/customization-history.js';

export interface OrchestratorDeps {
  readonly policy: CreatorPolicy;
  readonly inference: InferenceProvider;
  readonly history: CustomizationHistoryStore;
  readonly appVersion: string;
  /** Supplies the current timestamp (injectable for deterministic tests). */
  readonly now?: () => string;
}

/** A validated preview the caller can show before committing. */
export interface Preview {
  readonly view: ViewDescriptor;
  readonly simulated: boolean;
  readonly providerId: string;
  readonly rationale?: string;
}

export type ProposeOutcome =
  | { readonly ok: true; readonly preview: Preview }
  | { readonly ok: false; readonly result: Extract<ValidationResult, { ok: false }> };

export class CustomizationOrchestrator {
  private readonly deps: OrchestratorDeps;
  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
  }

  private now(): string {
    return (this.deps.now ?? (() => new Date().toISOString()))();
  }

  async proposeFromUtterance(
    base: ViewDescriptor,
    utterance: string,
  ): Promise<ProposeOutcome> {
    const request: InferenceRequest = {
      utterance,
      surface: {
        overridableTokens: Object.keys(this.deps.policy.tokenRules),
        allowedComponents: this.deps.policy.allowedComponents,
        allowedActions: this.deps.policy.allowedActions,
        currentViewSummary: summarizeView(base),
      },
    };
    const response = await this.deps.inference.propose(request);
    return this.previewProposal(base, response.proposal, {
      simulated: response.simulated,
      providerId: response.providerId,
    });
  }

  previewProposal(
    base: ViewDescriptor,
    proposal: CustomizationProposal,
    meta: { simulated: boolean; providerId: string },
  ): ProposeOutcome {
    const result = validateProposal(this.deps.policy, base, proposal);
    if (!result.ok) {
      return { ok: false, result };
    }
    const preview: Preview = {
      view: result.view,
      simulated: meta.simulated,
      providerId: meta.providerId,
      ...(proposal.rationale !== undefined ? { rationale: proposal.rationale } : {}),
    };
    return { ok: true, preview };
  }

  async applyAndSave(
    scope: HistoryScope,
    base: ViewDescriptor,
    previewView: ViewDescriptor,
    message: string,
  ): Promise<{ ok: true; view: ViewDescriptor } | ProposeOutcome> {
    const recheck = validateProposal(this.deps.policy, base, {
      tokens: diffTokens(base.tokens, previewView.tokens),
      components: previewView.components,
      controls: previewView.controls,
      actions: previewView.actions,
    });
    if (!recheck.ok) {
      return { ok: false, result: recheck };
    }
    const state: SavedCustomization = {
      view: recheck.view,
      appVersion: this.deps.appVersion,
      policyVersion: this.deps.policy.version,
      savedAt: this.now(),
    };
    await this.deps.history.save(scope, state, message);
    return { ok: true, view: recheck.view };
  }

  async reopen(
    scope: HistoryScope,
    defaultsView: ViewDescriptor,
  ): Promise<{ view: ViewDescriptor; usedFallback: boolean; staleAgainstPolicy: boolean }> {
    const saved = await this.deps.history.loadLatest(scope);
    if (!saved) {
      return { view: defaultsView, usedFallback: true, staleAgainstPolicy: false };
    }
    const revalidated = this.revalidateSaved(saved, defaultsView);
    return {
      view: revalidated.view,
      usedFallback: revalidated.usedFallback,
      staleAgainstPolicy: saved.policyVersion !== this.deps.policy.version,
    };
  }

  async undoTo(
    scope: HistoryScope,
    ref: string,
    defaultsView: ViewDescriptor,
  ): Promise<{ view: ViewDescriptor; usedFallback: boolean } | null> {
    const saved = await this.deps.history.loadAt(scope, ref);
    if (!saved) return null;
    return this.revalidateSaved(saved, defaultsView);
  }

  private revalidateSaved(
    saved: SavedCustomization,
    defaultsView: ViewDescriptor,
  ): { view: ViewDescriptor; usedFallback: boolean } {
    const result = validateProposal(this.deps.policy, defaultsView, {
      tokens: diffTokens(defaultsView.tokens, saved.view.tokens),
      components: saved.view.components,
      controls: saved.view.controls,
      actions: saved.view.actions,
    });
    if (result.ok) {
      return { view: result.view, usedFallback: false };
    }
    return { view: defaultsView, usedFallback: true };
  }
}

function summarizeView(view: ViewDescriptor): string {
  const comps = view.components.map((c) => c.componentId).join(', ');
  return `components: [${comps}]; controls: ${view.controls.length}; actions: ${view.actions.length}`;
}

/** Tokens present in `next` that differ from `base` (the override delta). */
function diffTokens(
  base: ViewDescriptor['tokens'],
  next: ViewDescriptor['tokens'],
): ViewDescriptor['tokens'] {
  const out: Record<string, (typeof next)[string]> = {};
  for (const key of Object.keys(next)) {
    if (base[key] !== next[key]) out[key] = next[key] as (typeof next)[string];
  }
  return out;
}

/**
 * TailoredUI `UiCapability` adapter for the Planner (spec task 4, R3).
 *
 * The Planner renders every component through this port and never imports a UI fork
 * directly. This adapter is the Planner's capability catalog: it lists the three
 * approved components (`board`, `agenda`, `task-card`) and resolves a component
 * reference + the active tokens into a DATA-ONLY `RenderDescriptor`. No executable
 * code crosses this boundary — the React layer reads the resolved props and draws.
 *
 * `resolve` returns null for unknown components as defense in depth; callers must
 * have already validated against the policy allow-list.
 */

import type {
  CapabilityComponentSpec,
  ComponentRef,
  RenderDescriptor,
  TokenSet,
  TokenValue,
  UiCapability,
} from '../ports/foundation.js';
import { PlannerComponents } from '../customization/policy.js';

const CATALOG: readonly CapabilityComponentSpec[] = [
  { componentId: PlannerComponents.Board, props: ['density', 'fontScale', 'layout'] },
  { componentId: PlannerComponents.Agenda, props: ['density', 'fontScale', 'layout'] },
  { componentId: PlannerComponents.TaskCard, props: ['density', 'fontScale'] },
];

function num(tokens: TokenSet, key: string, fallback: number): number {
  const v: TokenValue | undefined = tokens[key];
  return typeof v === 'number' ? v : fallback;
}

function str(tokens: TokenSet, key: string, fallback: string): string {
  const v: TokenValue | undefined = tokens[key];
  return typeof v === 'string' ? v : fallback;
}

export class TailoredUiCapabilityAdapter implements UiCapability {
  listComponents(): readonly CapabilityComponentSpec[] {
    return CATALOG;
  }

  resolve(ref: ComponentRef, tokens: TokenSet): RenderDescriptor | null {
    const spec = CATALOG.find((c) => c.componentId === ref.componentId);
    if (!spec) return null;

    const density = str(tokens, 'density', 'comfortable');
    const fontScale = num(tokens, 'fontScale', 1);

    switch (ref.componentId) {
      case PlannerComponents.Board:
        return {
          componentId: ref.componentId,
          resolvedProps: { layout: 'board', density, fontScale },
        };
      case PlannerComponents.Agenda:
        return {
          componentId: ref.componentId,
          resolvedProps: { layout: 'agenda', density, fontScale },
        };
      case PlannerComponents.TaskCard:
        return {
          componentId: ref.componentId,
          resolvedProps: { density, fontScale },
        };
      default:
        return null;
    }
  }
}

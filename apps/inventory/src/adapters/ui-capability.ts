/**
 * TailoredUI `UiCapability` adapter for the Inventory app.
 *
 * The app renders every component through this port and never imports a UI fork
 * directly. This adapter is the Inventory capability catalog: it lists the four
 * approved components (`grid`, `list`, `low-stock-view`, `item-card`) and resolves a
 * component reference + the active tokens into a DATA-ONLY `RenderDescriptor`. No
 * executable code crosses this boundary — the React layer reads the resolved props
 * and draws.
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
import { InventoryComponents } from '../customization/policy.js';

const CATALOG: readonly CapabilityComponentSpec[] = [
  { componentId: InventoryComponents.Grid, props: ['density', 'fontScale', 'layout', 'lowStockOnly'] },
  { componentId: InventoryComponents.List, props: ['density', 'fontScale', 'layout', 'lowStockOnly'] },
  { componentId: InventoryComponents.LowStockView, props: ['density', 'fontScale', 'layout', 'lowStockOnly'] },
  { componentId: InventoryComponents.ItemCard, props: ['density', 'fontScale'] },
];

function num(tokens: TokenSet, key: string, fallback: number): number {
  const v: TokenValue | undefined = tokens[key];
  return typeof v === 'number' ? v : fallback;
}

function str(tokens: TokenSet, key: string, fallback: string): string {
  const v: TokenValue | undefined = tokens[key];
  return typeof v === 'string' ? v : fallback;
}

function bool(tokens: TokenSet, key: string, fallback: boolean): boolean {
  const v: TokenValue | undefined = tokens[key];
  return typeof v === 'boolean' ? v : fallback;
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
    const lowStockOnly = bool(tokens, 'lowStockOnly', false);

    switch (ref.componentId) {
      case InventoryComponents.Grid:
        return {
          componentId: ref.componentId,
          resolvedProps: { layout: 'grid', density, fontScale, lowStockOnly },
        };
      case InventoryComponents.List:
        return {
          componentId: ref.componentId,
          resolvedProps: { layout: 'list', density, fontScale, lowStockOnly },
        };
      case InventoryComponents.LowStockView:
        return {
          componentId: ref.componentId,
          // The low-stock view is a list layout with the filter forced on.
          resolvedProps: { layout: 'list', density, fontScale, lowStockOnly: true },
        };
      case InventoryComponents.ItemCard:
        return {
          componentId: ref.componentId,
          resolvedProps: { density, fontScale },
        };
      default:
        return null;
    }
  }
}

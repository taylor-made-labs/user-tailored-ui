/**
 * UI-capability port (hexagonal) — a thin interface over the TailoredUI fork.
 * App code renders through this port and never imports the fork directly, so the
 * fork can be swapped or upgraded behind a pinned, documented contract.
 *
 * This keeps app-specific policy/workflows OUT of the fork (steering 00-project).
 * The concrete adapter over TailoredUI is added in a later PR.
 */

import type { ComponentRef, TokenSet } from '../domain/customization/types.js';

/** Describes an approved component the capability layer can render. */
export interface CapabilityComponentSpec {
  readonly componentId: string;
  /** Declared, policy-constrainable props and their token kinds. */
  readonly props: readonly string[];
}

export interface UiCapability {
  /** The set of components this capability layer can render (the raw catalog). */
  listComponents(): readonly CapabilityComponentSpec[];
  /**
   * Resolve a component reference + active tokens into a render descriptor.
   * Returns null for unknown components (callers must have already validated against
   * the policy allow-list; this is defense in depth).
   */
  resolve(ref: ComponentRef, tokens: TokenSet): RenderDescriptor | null;
}

/** Data-only render descriptor. No executable code crosses this boundary. */
export interface RenderDescriptor {
  readonly componentId: string;
  readonly resolvedProps: Readonly<Record<string, unknown>>;
}

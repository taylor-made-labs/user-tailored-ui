/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/ports/ui-capability.ts).
 * Faithful copy of the foundation's UI-capability port. Consumed behind a port.
 */

import type { ComponentRef, TokenSet } from '../domain/customization/types.js';

/** Describes an approved component the capability layer can render. */
export interface CapabilityComponentSpec {
  readonly componentId: string;
  readonly props: readonly string[];
}

export interface UiCapability {
  listComponents(): readonly CapabilityComponentSpec[];
  resolve(ref: ComponentRef, tokens: TokenSet): RenderDescriptor | null;
}

/** Data-only render descriptor. No executable code crosses this boundary. */
export interface RenderDescriptor {
  readonly componentId: string;
  readonly resolvedProps: Readonly<Record<string, unknown>>;
}

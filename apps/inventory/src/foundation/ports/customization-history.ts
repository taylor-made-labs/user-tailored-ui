/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/ports/customization-history.ts).
 * Faithful copy of the foundation's customization-history port. Consumed behind a port.
 *
 * Customization history is scoped per user+app and kept SEPARATE from business data.
 */

import type { ViewDescriptor } from '../domain/customization/types.js';

/** A versioned, saved customization state entry. */
export interface SavedCustomization {
  readonly view: ViewDescriptor;
  readonly appVersion: string;
  readonly policyVersion: string;
  readonly savedAt: string;
}

/** Identifies a single commit/point in the user's customization history. */
export interface HistoryRef {
  readonly id: string;
  readonly savedAt: string;
  readonly message: string;
}

export interface CustomizationHistoryStore {
  save(scope: HistoryScope, state: SavedCustomization, message: string): Promise<HistoryRef>;
  loadLatest(scope: HistoryScope): Promise<SavedCustomization | null>;
  list(scope: HistoryScope): Promise<readonly HistoryRef[]>;
  loadAt(scope: HistoryScope, ref: string): Promise<SavedCustomization | null>;
}

/** Scopes history strictly to one user and one app, enforcing user separation. */
export interface HistoryScope {
  readonly userId: string;
  readonly appId: string;
}

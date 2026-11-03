/**
 * Customization-history port (hexagonal) — a thin interface over `browser-repos`
 * (IndexedDB-backed Git). Customization history is scoped per user+app and kept
 * SEPARATE from business data and creator-owned source.
 *
 * Rollback here must never revert business data (tasks/stock), never affect other
 * users, and never change creator defaults — it only moves the user's customization
 * state. Saved state is versioned against app + policy versions so it can be
 * revalidated (and migrated or safely fallen back) on reopen/rollback.
 *
 * Concrete adapter over browser-repos is added in a later PR; an in-memory double is
 * used for deterministic tests.
 */

import type { ViewDescriptor } from '../domain/customization/types.js';

/** A versioned, saved customization state entry. */
export interface SavedCustomization {
  /** The validated view at save time. */
  readonly view: ViewDescriptor;
  /** App version the state was produced under. */
  readonly appVersion: string;
  /** Policy version the state was validated under. */
  readonly policyVersion: string;
  /** ISO timestamp. */
  readonly savedAt: string;
}

/** Identifies a single commit/point in the user's customization history. */
export interface HistoryRef {
  readonly id: string;
  readonly savedAt: string;
  readonly message: string;
}

export interface CustomizationHistoryStore {
  /** Save a new validated customization state; returns its history ref. */
  save(scope: HistoryScope, state: SavedCustomization, message: string): Promise<HistoryRef>;
  /** Load the latest saved state for a scope, if any. */
  loadLatest(scope: HistoryScope): Promise<SavedCustomization | null>;
  /** List history newest-first. */
  list(scope: HistoryScope): Promise<readonly HistoryRef[]>;
  /** Load the state at a specific history ref (for undo/rollback). */
  loadAt(scope: HistoryScope, ref: string): Promise<SavedCustomization | null>;
}

/** Scopes history strictly to one user and one app, enforcing user separation. */
export interface HistoryScope {
  readonly userId: string;
  readonly appId: string;
}

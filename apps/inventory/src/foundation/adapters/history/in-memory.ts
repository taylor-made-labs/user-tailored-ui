/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/adapters/history/in-memory.ts).
 * Faithful copy of the foundation's in-memory customization-history store (test double).
 *
 * Deterministic, no IndexedDB — used by CI to exercise save/reopen/undo and to prove
 * USER SEPARATION (state keyed strictly by user+app scope).
 */

import type {
  CustomizationHistoryStore,
  HistoryRef,
  HistoryScope,
  SavedCustomization,
} from '../../ports/customization-history.js';

interface Entry {
  readonly ref: HistoryRef;
  readonly state: SavedCustomization;
}

export class InMemoryHistoryStore implements CustomizationHistoryStore {
  private readonly byScope = new Map<string, Entry[]>();
  private seq = 0;

  private key(scope: HistoryScope): string {
    return `${encodeURIComponent(scope.userId)}::${encodeURIComponent(scope.appId)}`;
  }

  save(
    scope: HistoryScope,
    state: SavedCustomization,
    message: string,
  ): Promise<HistoryRef> {
    const k = this.key(scope);
    const list = this.byScope.get(k) ?? [];
    const ref: HistoryRef = {
      id: `h${++this.seq}`,
      savedAt: state.savedAt,
      message,
    };
    list.push({ ref, state });
    this.byScope.set(k, list);
    return Promise.resolve(ref);
  }

  loadLatest(scope: HistoryScope): Promise<SavedCustomization | null> {
    const list = this.byScope.get(this.key(scope));
    if (!list || list.length === 0) return Promise.resolve(null);
    return Promise.resolve(list[list.length - 1]!.state);
  }

  list(scope: HistoryScope): Promise<readonly HistoryRef[]> {
    const list = this.byScope.get(this.key(scope)) ?? [];
    return Promise.resolve([...list].reverse().map((e) => e.ref));
  }

  loadAt(scope: HistoryScope, ref: string): Promise<SavedCustomization | null> {
    const list = this.byScope.get(this.key(scope)) ?? [];
    const found = list.find((e) => e.ref.id === ref);
    return Promise.resolve(found ? found.state : null);
  }
}

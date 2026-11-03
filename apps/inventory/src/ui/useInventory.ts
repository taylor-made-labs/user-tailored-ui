/**
 * React state hook binding the pure domain + the customization service to the UI.
 * It owns no business rules — those live in the domain and the validator. It wires:
 *   - item create/edit/adjustQty/delete, persisted to the IndexedDB item store,
 *   - the agent panel flow: utterance -> preview -> apply / reject / undo,
 *   - reopen of saved customization under current policy on first load.
 *
 * Stores are injectable so a test (or the demo) can pass in-memory doubles; the app
 * entry wires the IndexedDB + in-memory-history defaults.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adjustQty,
  createItem,
  deleteItem,
  editItem,
  sortItems,
  systemClock,
  type CreateItemInput,
  type EditItemInput,
  type Item,
} from '../domain/item.js';
import type { ItemStore } from '../ports/item-store.js';
import {
  InventoryCustomization,
  type InventoryCustomizationDeps,
} from '../customization/service.js';
import type {
  HistoryRef,
  RejectionReason,
  ViewDescriptor,
} from '../ports/foundation.js';

export interface InventoryPreview {
  readonly view: ViewDescriptor;
  readonly simulated: boolean;
  readonly providerId: string;
  readonly rationale?: string;
}

export interface UseInventoryArgs {
  readonly userId: string;
  readonly itemStore: ItemStore;
  readonly customizationDeps?: Omit<InventoryCustomizationDeps, 'userId'>;
}

export interface InventoryState {
  readonly items: readonly Item[];
  readonly view: ViewDescriptor;
  readonly preview: InventoryPreview | null;
  readonly rejection: readonly RejectionReason[] | null;
  readonly history: readonly HistoryRef[];
  readonly addItem: (input: CreateItemInput) => void;
  readonly editItemFields: (id: string, input: EditItemInput) => void;
  readonly adjust: (id: string, delta: number) => void;
  readonly removeItem: (id: string) => void;
  readonly propose: (utterance: string) => Promise<void>;
  readonly applyPreview: () => Promise<void>;
  readonly dismissPreview: () => void;
  readonly undo: (ref: string) => Promise<void>;
}

export function useInventory(args: UseInventoryArgs): InventoryState {
  const { userId, itemStore } = args;
  const cz = useMemo(
    () => new InventoryCustomization({ userId, ...args.customizationDeps }),
    // Service identity is stable per user for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const [items, setItems] = useState<readonly Item[]>([]);
  const [view, setView] = useState<ViewDescriptor>(cz.defaults);
  const [preview, setPreview] = useState<InventoryPreview | null>(null);
  const [rejection, setRejection] = useState<readonly RejectionReason[] | null>(null);
  const [history, setHistory] = useState<readonly HistoryRef[]>([]);

  const refreshHistory = useCallback(async () => {
    setHistory(await cz.listHistory());
  }, [cz]);

  // Load persisted items + revalidate any saved customization under current policy.
  useEffect(() => {
    let live = true;
    void (async () => {
      const loaded = sortItems(await itemStore.load(userId));
      if (!live) return;
      setItems(loaded);
      const reopened = await cz.reopen();
      if (!live) return;
      setView(reopened.view);
      await refreshHistory();
    })();
    return () => {
      live = false;
    };
  }, [cz, itemStore, userId, refreshHistory]);

  const persist = useCallback(
    (next: readonly Item[]) => {
      setItems(next);
      void itemStore.save(userId, next);
    },
    [itemStore, userId],
  );

  const addItem = useCallback(
    (input: CreateItemInput) => {
      if (input.name.trim().length === 0) return;
      persist(createItem(items, input, systemClock));
    },
    [items, persist],
  );

  const editItemFields = useCallback(
    (id: string, input: EditItemInput) => {
      persist(editItem(items, id, input, systemClock));
    },
    [items, persist],
  );

  const adjust = useCallback(
    (id: string, delta: number) => {
      persist(adjustQty(items, id, delta, systemClock));
    },
    [items, persist],
  );

  const removeItem = useCallback(
    (id: string) => {
      persist(deleteItem(items, id));
    },
    [items, persist],
  );

  const propose = useCallback(
    async (utterance: string) => {
      setRejection(null);
      setPreview(null);
      const outcome = await cz.proposeFromUtterance(view, utterance);
      if (outcome.ok) {
        setPreview({
          view: outcome.preview.view,
          simulated: outcome.preview.simulated,
          providerId: outcome.preview.providerId,
          ...(outcome.preview.rationale !== undefined
            ? { rationale: outcome.preview.rationale }
            : {}),
        });
      } else {
        setRejection(outcome.result.reasons);
      }
    },
    [cz, view],
  );

  const applyPreview = useCallback(async () => {
    if (!preview) return;
    const res = await cz.apply(view, preview.view, preview.rationale ?? 'customize');
    if (res.ok) {
      setView(res.view);
      setPreview(null);
      setRejection(null);
      await refreshHistory();
    } else {
      setRejection(res.result.reasons);
      setPreview(null);
    }
  }, [cz, view, preview, refreshHistory]);

  const dismissPreview = useCallback(() => {
    setPreview(null);
    setRejection(null);
  }, []);

  const undo = useCallback(
    async (ref: string) => {
      const res = await cz.undoTo(ref);
      if (res) {
        setView(res.view);
        setPreview(null);
        setRejection(null);
      }
    },
    [cz],
  );

  return {
    items,
    view,
    preview,
    rejection,
    history,
    addItem,
    editItemFields,
    adjust,
    removeItem,
    propose,
    applyPreview,
    dismissPreview,
    undo,
  };
}

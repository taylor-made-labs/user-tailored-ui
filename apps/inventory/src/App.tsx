/**
 * Inventory app shell.
 *
 * Composes the item grid/list (rendered through the UiCapability port) with the
 * in-app agent panel. Business item state and customization state are two separate
 * concerns wired together here by the `useInventory` hook; neither can corrupt the
 * other. Stores are injected by `main.tsx` (IndexedDB for items, browser-repos-backed
 * history), and are also injectable for tests/demo.
 */

import type { ItemStore } from './ports/item-store.js';
import { useInventory } from './ui/useInventory.js';
import type { InventoryCustomizationDeps } from './customization/service.js';
import { AddItem, ItemList } from './ui/components.js';
import { AgentPanel } from './ui/AgentPanel.js';
import { useApiKey } from './ui/useApiKey.js';
import { SessionKeyStore, type KeyStore } from './ports/foundation.js';

const noKeyStore = new SessionKeyStore();

export interface AppProps {
  readonly userId: string;
  readonly itemStore: ItemStore;
  /** Customization-store wiring (history/inference). `main.tsx` injects the
   *  browser-repos-backed history store here; omit for the in-memory default. */
  readonly customizationDeps: Omit<InventoryCustomizationDeps, 'userId'>;
  /** Present in the product: gates Ask on a key. Absent only under the dev test-double flag. */
  readonly keyStore?: KeyStore;
}

export function App(props: AppProps): JSX.Element {
  const inventory = useInventory({
    userId: props.userId,
    itemStore: props.itemStore,
    customizationDeps: props.customizationDeps,
  });
  const apiKey = useApiKey(props.keyStore ?? noKeyStore);
  const isLowStockView = inventory.view.components.some(
    (c) => c.componentId === 'low-stock-view',
  );

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1040, margin: '0 auto', padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ marginBottom: 2 }}>User-Tailored Inventory</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>
          View: <strong>{isLowStockView ? 'low-stock focus' : 'full catalog'}</strong>
        </p>
      </header>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <section style={{ flex: 1 }}>
          <AddItem onAdd={inventory.addItem} />
          <ItemList
            view={inventory.view}
            items={inventory.items}
            onAdjust={inventory.adjust}
            onEditName={(id, name) => inventory.editItemFields(id, { name })}
            onDelete={inventory.removeItem}
          />
        </section>
        <AgentPanel inventory={inventory} {...(props.keyStore ? { apiKey } : {})} />
      </div>
    </main>
  );
}

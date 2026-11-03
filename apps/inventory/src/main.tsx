import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { IndexedDbItemStore } from './adapters/item-store-indexeddb.js';

// Business items persist in IndexedDB (never localStorage/chrome.storage).
// Customization history defaults to the in-memory double inside the service; an
// IndexedDB-backed store is a later, port-compatible swap.
const itemStore = new IndexedDbItemStore();

// A single local user for this slice. Multi-user accounts/auth are out of scope;
// user separation is demonstrated via scoped ids (here and in the stores).
const userId = 'local-user';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App userId={userId} itemStore={itemStore} />
    </StrictMode>,
  );
}

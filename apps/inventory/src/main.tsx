import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { IndexedDbItemStore } from './adapters/item-store-indexeddb.js';
import { BrowserReposHistoryStore } from './ports/foundation.js';

// Business items persist in IndexedDB (never localStorage/chrome.storage).
const itemStore = new IndexedDbItemStore();

// Customization history is backed by the real browser-repos library: every save is
// a git commit in an IndexedDB-backed repo, so the user's tailored UI survives a
// reload. This is the headline "state lives in a browser-based git repo" claim made
// real — it replaces the in-memory double, which now serves tests only. The repo is
// separate from the item database above, keeping business data and customization apart.
const historyStore = new BrowserReposHistoryStore({
  repoPrefix: 'inventory-history',
  author: { name: 'user-tailored-inventory', email: 'history@user-tailored-inventory.local' },
});

// A single local user for this slice. Multi-user accounts/auth are out of scope;
// user separation is demonstrated via scoped ids (here and in the stores).
const userId = 'local-user';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App userId={userId} itemStore={itemStore} customizationDeps={{ history: historyStore }} />
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { IndexedDbTaskStore } from './adapters/task-store-indexeddb.js';
import { BrowserReposHistoryStore } from './adapters/history-browser-repos.js';

// Business tasks persist in IndexedDB (never localStorage/chrome.storage).
const taskStore = new IndexedDbTaskStore();

// Customization history is backed by the real browser-repos library: every save is
// a git commit in an IndexedDB-backed repo, so the user's tailored UI survives a
// reload. This is the headline "state lives in a browser-based git repo" claim made
// real — it replaces the in-memory double, which now serves tests only. The repo is
// separate from the task database above, keeping business data and customization apart.
const historyStore = new BrowserReposHistoryStore();

// A single local user for this slice. Multi-user accounts/auth are out of scope;
// user separation is demonstrated via scoped ids (here and in the stores).
const userId = 'local-user';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App userId={userId} taskStore={taskStore} customizationDeps={{ history: historyStore }} />
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TestDoubleInferenceAdapter, SessionKeyStore, type InferenceProvider } from './ports/foundation.js';
import { createProductInference } from './inference.js';
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

// Real inference is the product path. The deterministic test double is reachable ONLY
// through the VITE_ENABLE_TEST_DOUBLE dev-server flag (vite.config.ts); production builds fold the branch away
// (checked in CI by scripts/check-no-test-double.mjs). The dynamic import keeps the
// script out of the production bundle.
const keyStore = new SessionKeyStore();
const useDouble = __ENABLE_TEST_DOUBLE__;

async function makeInference(): Promise<InferenceProvider> {
  if (!__ENABLE_TEST_DOUBLE__) return createProductInference(keyStore);
  const { plannerAgentScript } = await import('./customization/agent-script.js');
  return new TestDoubleInferenceAdapter(plannerAgentScript);
}

void makeInference().then((inference) => {
  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <App userId={userId} taskStore={taskStore} customizationDeps={{ history: historyStore, inference }}
            {...(useDouble ? {} : { keyStore })}
          />
      </StrictMode>,
    );
  }
});

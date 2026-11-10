/**
 * Test setup: give Node an in-process IndexedDB and a deterministic LightningFS
 * mutex path, so the browser-repos-backed history store runs under vitest exactly
 * as it does on CI (Node 20).
 *
 * `fake-indexeddb/auto` installs a spec-compliant IndexedDB on the global. It
 * persists across separate LightningFS handles within one process, which is what
 * lets a test prove real close-and-reopen durability.
 */
import 'fake-indexeddb/auto';

/**
 * LightningFS's DefaultBackend reads `navigator.locks` to choose its mutex: the Web
 * Locks API when present, otherwise an IndexedDB-backed mutex. Under Node this
 * forks dangerously:
 *   - Node 20 (our CI) has no global `navigator` — DefaultBackend throws
 *     "navigator is not defined" before the fallback is reached;
 *   - newer local Node (21+) DOES expose `navigator.locks`, so a local run would
 *     take the Web Locks path while CI takes the IndexedDB path — different code.
 * Pin a `navigator` with no `locks` so LightningFS always takes the IndexedDB-backed
 * mutex (the one fake-indexeddb supports), identically on every Node version. The
 * library never reads navigator itself; this only shapes the Node test environment.
 */
Object.defineProperty(globalThis, 'navigator', {
  value: {},
  configurable: true,
  writable: true,
});

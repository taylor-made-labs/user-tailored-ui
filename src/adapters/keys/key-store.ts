/**
 * KeyStore (design 4.4, R3.3). Session store is the default: the key lives in memory
 * and dies with the page. IdbKeyStore persists only when the user asks to "remember",
 * in the user's own same-origin IndexedDB. Plain storage for now; WebCrypto wrapping
 * is T3.6. Nothing here is reachable from the history adapter or the exporter.
 */
import { SecretString } from '../../security/secret-string.js';

export interface KeyStore {
  get(): Promise<SecretString | undefined>;
  set(key: SecretString): Promise<void>;
  clear(): Promise<void>;
}

export class SessionKeyStore implements KeyStore {
  #key: SecretString | undefined;

  get(): Promise<SecretString | undefined> {
    return Promise.resolve(this.#key);
  }
  set(key: SecretString): Promise<void> {
    this.#key = key;
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.#key = undefined;
    return Promise.resolve();
  }
}

const DB_NAME = 'utui-secrets';
const STORE = 'keys';
const ID = 'anthropic';

export class IdbKeyStore implements KeyStore {
  readonly #idb: IDBFactory;

  constructor(idb: IDBFactory = globalThis.indexedDB) {
    this.#idb = idb;
  }

  #open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = this.#idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('Key store unavailable'));
    });
  }

  async #run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error('Key store request failed'));
      });
    } finally {
      db.close();
    }
  }

  async get(): Promise<SecretString | undefined> {
    const row = await this.#run<{ key?: unknown } | undefined>('readonly', (s) => s.get(ID));
    return typeof row?.key === 'string' ? new SecretString(row.key) : undefined;
  }

  async set(key: SecretString): Promise<void> {
    await this.#run('readwrite', (s) => s.put({ id: ID, key: key.reveal() }));
  }

  async clear(): Promise<void> {
    await this.#run('readwrite', (s) => s.delete(ID));
  }
}

/** VENDORED from @taylor-made-labs/user-tailored-ui (src/adapters/history/browser-repos.ts); edit it there. */
/**
 * browser-repos-backed customization-history store (spec R5; the "state lives in a
 * browser-based git repo" headline claim, made real).
 *
 * This is the PRODUCTION adapter for an app's customization history (shared by the
 * Planner and Inventory; each passes its own `repoPrefix` and `author`). It
 * implements the same `CustomizationHistoryStore` port as the in-memory double, but
 * every save is a real git commit in an IndexedDB-backed repository provided by the
 * `@taylor-made-labs/browser-repos` library (isomorphic-git over LightningFS). History
 * therefore survives a page reload the way the in-memory double never could: reopening
 * the repo from the same IndexedDB replays the same commit history.
 *
 * Contract honored (browser-repos steering + the foundation port):
 *   - storage is IndexedDB ONLY, through the library — never localStorage/chrome.storage;
 *   - the library core stays pure: we drive it only through its public surface
 *     (`RepoManager` / `BrowserRepo`), never its internals;
 *   - no credential is read, written, or persisted; commit author is plain metadata;
 *   - customization history is kept in its OWN repo, per user+app scope, separate from
 *     business task data (which lives in a distinct IndexedDB database).
 *
 * Layout inside each scope's repo (one repo per user+app):
 *   entries/<0-padded seq>.json   — one file per saved customization, append-only.
 * Each save writes the next entry file and commits it, so the git log is a 1:1,
 * newest-first record of the saved history. A history ref id is the commit oid.
 */

import type {
  CustomizationHistoryStore,
  HistoryRef,
  HistoryScope,
  SavedCustomization,
} from '../../ports/customization-history.js';
import {
  RepoManager,
  type BrowserRepo,
  type CommitAuthor,
  type RepoManagerOptions,
} from '@taylor-made-labs/browser-repos';

/** Per-app identity. `repoPrefix` namespaces repo ids; `author` is plain commit metadata. */
export interface BrowserReposHistoryOptions extends RepoManagerOptions {
  /** Repo-id prefix, e.g. `planner-history`. Changing it orphans existing saved history. */
  readonly repoPrefix: string;
  /** Commit author on every history commit. Never a credential. */
  readonly author: CommitAuthor;
}

/** Directory inside each repo holding the append-only entry files. */
const ENTRIES_DIR = 'entries';

/** On-disk shape of one saved entry (the state plus its display message). */
interface StoredEntry {
  readonly state: SavedCustomization;
  readonly message: string;
}

/** Zero-pad a sequence number so lexical sort matches numeric order. */
function seqName(seq: number): string {
  return `${ENTRIES_DIR}/${String(seq).padStart(6, '0')}.json`;
}

/**
 * A customization-history store backed by browser-repos. Construct one per app; it is
 * cheap and holds a single `RepoManager`. Pass `backendFactory` (forwarded to the
 * library) to drive a swappable store in tests; omit it to use the default IndexedDB
 * backend in the browser.
 */
export class BrowserReposHistoryStore implements CustomizationHistoryStore {
  private readonly manager: RepoManager;
  /** One open-repo promise per scope key, so concurrent calls share one handle. */
  private readonly repos = new Map<string, Promise<BrowserRepo>>();

  private readonly repoPrefix: string;
  private readonly author: CommitAuthor;

  constructor({ repoPrefix, author, ...managerOptions }: BrowserReposHistoryOptions) {
    this.repoPrefix = repoPrefix;
    this.author = author;
    this.manager = new RepoManager(managerOptions);
  }

  /** Stable repo id for a scope. Mirrors the in-memory double's scope key. */
  private repoId(scope: HistoryScope): string {
    // RepoManager ids allow [A-Za-z0-9._-]; encode the scope into that alphabet.
    const enc = (s: string): string =>
      encodeURIComponent(s).replace(/[^A-Za-z0-9._-]/g, (c) => `-${c.charCodeAt(0).toString(16)}`);
    return `${this.repoPrefix}.${enc(scope.userId)}.${enc(scope.appId)}`;
  }

  /** Open (creating on first use) the repo for a scope; shared across calls. */
  private repoFor(scope: HistoryScope): Promise<BrowserRepo> {
    const id = this.repoId(scope);
    let pending = this.repos.get(id);
    if (!pending) {
      pending = this.openOrCreate(id);
      this.repos.set(id, pending);
    }
    return pending;
  }

  private async openOrCreate(id: string): Promise<BrowserRepo> {
    return (await this.manager.hasRepo(id))
      ? this.manager.openRepo(id)
      : this.manager.createRepo(id);
  }

  /** Entry files present, as padded names sorted oldest-first. */
  private async entryNames(repo: BrowserRepo): Promise<string[]> {
    if (!(await repo.exists(ENTRIES_DIR))) return [];
    const dir = await repo.listFiles(ENTRIES_DIR);
    return dir
      .filter((e) => !e.isDirectory && e.name.endsWith('.json'))
      .map((e) => `${ENTRIES_DIR}/${e.name}`)
      .sort();
  }

  private async readEntry(repo: BrowserRepo, path: string): Promise<StoredEntry> {
    return JSON.parse(await repo.readFile(path)) as StoredEntry;
  }

  async save(
    scope: HistoryScope,
    state: SavedCustomization,
    message: string,
  ): Promise<HistoryRef> {
    const repo = await this.repoFor(scope);
    const seq = (await this.entryNames(repo)).length; // next index, 0-based
    const path = seqName(seq);
    const entry: StoredEntry = { state, message };
    await repo.writeFile(path, JSON.stringify(entry));
    await repo.stage(path);
    const oid = await repo.commit({ message, author: this.author });
    return { id: oid, savedAt: state.savedAt, message };
  }

  async loadLatest(scope: HistoryScope): Promise<SavedCustomization | null> {
    const repo = await this.repoFor(scope);
    const names = await this.entryNames(repo);
    const last = names[names.length - 1];
    if (!last) return null;
    return (await this.readEntry(repo, last)).state;
  }

  async list(scope: HistoryScope): Promise<readonly HistoryRef[]> {
    const repo = await this.repoFor(scope);
    const names = await this.entryNames(repo); // oldest-first
    const commits = await repo.log(); // newest-first; one commit per entry
    // log[i] is the (total-1-i)-th oldest entry — a 1:1 newest-first pairing.
    const refs: HistoryRef[] = [];
    for (let i = 0; i < commits.length && i < names.length; i++) {
      const entry = await this.readEntry(repo, names[names.length - 1 - i]!);
      refs.push({ id: commits[i]!.oid, savedAt: entry.state.savedAt, message: entry.message });
    }
    return refs;
  }

  async loadAt(scope: HistoryScope, ref: string): Promise<SavedCustomization | null> {
    const repo = await this.repoFor(scope);
    const commits = await repo.log(); // newest-first
    const idx = commits.findIndex((c) => c.oid === ref);
    if (idx === -1) return null;
    const names = await this.entryNames(repo); // oldest-first
    const name = names[names.length - 1 - idx];
    if (!name) return null;
    return (await this.readEntry(repo, name)).state;
  }
}

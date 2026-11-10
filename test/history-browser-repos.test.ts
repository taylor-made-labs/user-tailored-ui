import { describe, it, expect } from 'vitest';
import { BrowserReposHistoryStore, type SavedCustomization } from '../src/index.js';

const scope = { userId: 'u1', appId: 'app' };
const state = (savedAt: string): SavedCustomization => ({ savedAt }) as unknown as SavedCustomization;
const options = (repoPrefix: string) => ({
  repoPrefix,
  author: { name: repoPrefix, email: `${repoPrefix}@local` },
});

describe('BrowserReposHistoryStore (shared adapter)', () => {
  it('survives a fresh store over the same IndexedDB, newest-first', async () => {
    const a = new BrowserReposHistoryStore(options('t-reload'));
    await a.save(scope, state('2026-01-01T00:00:00Z'), 'one');
    const ref2 = await a.save(scope, state('2026-01-02T00:00:00Z'), 'two');

    const b = new BrowserReposHistoryStore(options('t-reload'));
    expect((await b.list(scope)).map((r) => r.message)).toEqual(['two', 'one']);
    expect((await b.loadLatest(scope))?.savedAt).toBe('2026-01-02T00:00:00Z');
    expect((await b.loadAt(scope, ref2.id))?.savedAt).toBe('2026-01-02T00:00:00Z');
    expect(await b.loadAt(scope, 'nope')).toBeNull();
  });

  it('keeps different repoPrefix values apart', async () => {
    await new BrowserReposHistoryStore(options('t-a')).save(scope, state('2026-01-01T00:00:00Z'), 'a');
    expect(await new BrowserReposHistoryStore(options('t-b')).loadLatest(scope)).toBeNull();
  });
});

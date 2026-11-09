/**
 * Persistence proof for the browser-repos-backed customization history (R5).
 *
 * This is the test that proves the headline claim is REAL, not a stub: the user's
 * tailored-UI history lives in a browser-based git repo (IndexedDB-git via the
 * `@taylor-made-labs/browser-repos` library), so it survives a page reload.
 *
 * "Reload" is simulated the only honest way under Node: throw away the live store
 * handle (and its RepoManager / open-repo cache) and build a brand-new
 * `BrowserReposHistoryStore` over the SAME IndexedDB (fake-indexeddb persists across
 * handles within one process, see test/setup.ts). If the second store reads back the
 * commits the first one wrote, the state truly round-tripped through IndexedDB-git —
 * an in-memory double would read back nothing.
 */

import { describe, it, expect } from 'vitest';
import { BrowserReposHistoryStore } from '../src/adapters/history-browser-repos.js';
import { PlannerCustomization } from '../src/customization/service.js';
import { agendaProposal, defaultBoardView } from '../src/customization/views.js';
import { PlannerControls } from '../src/customization/policy.js';
import type { HistoryScope, SavedCustomization } from '../src/ports/foundation.js';

const scope: HistoryScope = { userId: 'local-user', appId: 'user-tailored-planner' };

function sampleState(savedAt: string, fontScale: number): SavedCustomization {
  return {
    view: {
      ...defaultBoardView,
      tokens: { ...defaultBoardView.tokens, fontScale },
    },
    appVersion: '0.1.0',
    policyVersion: 'test',
    savedAt,
  };
}

describe('browser-repos history store: persistence across a simulated reload', () => {
  it('reads back, in order, the history a prior store committed to IndexedDB-git', async () => {
    // --- First "session": write three saves through the real IndexedDB-git store ---
    const first = new BrowserReposHistoryStore();
    const r1 = await first.save(scope, sampleState('2026-11-09T00:00:01.000Z', 1), 'first');
    const r2 = await first.save(scope, sampleState('2026-11-09T00:00:02.000Z', 1.5), 'second');
    const r3 = await first.save(scope, sampleState('2026-11-09T00:00:03.000Z', 2), 'third');
    // Commit oids are real git oids: 40-hex, and all distinct.
    for (const r of [r1, r2, r3]) expect(r.id).toMatch(/^[0-9a-f]{40}$/);
    expect(new Set([r1.id, r2.id, r3.id]).size).toBe(3);

    // --- Simulate reload: drop the handle, open a FRESH store over the same store ---
    const reloaded = new BrowserReposHistoryStore();

    const latest = await reloaded.loadLatest(scope);
    expect(latest).not.toBeNull();
    expect(latest!.savedAt).toBe('2026-11-09T00:00:03.000Z');
    expect(latest!.view.tokens.fontScale).toBe(2);

    const refs = await reloaded.list(scope);
    expect(refs.map((r) => r.message)).toEqual(['third', 'second', 'first']); // newest-first
    expect(refs.map((r) => r.id)).toEqual([r3.id, r2.id, r1.id]);

    // loadAt reaches an older point by its commit oid — read back from the reopened repo.
    const atFirst = await reloaded.loadAt(scope, r1.id);
    expect(atFirst).not.toBeNull();
    expect(atFirst!.view.tokens.fontScale).toBe(1);
    expect(atFirst!.savedAt).toBe('2026-11-09T00:00:01.000Z');
  });

  it('user separation: a different scope sees none of the above history', async () => {
    const store = new BrowserReposHistoryStore();
    const other: HistoryScope = { userId: 'someone-else', appId: 'user-tailored-planner' };
    expect(await store.loadLatest(other)).toBeNull();
    expect((await store.list(other)).length).toBe(0);
  });

  it('end-to-end: the service applies + reopens an agenda through the git-backed store', async () => {
    const stubNow = (): string => '2026-11-09T00:00:00.000Z';
    const history = new BrowserReposHistoryStore();
    const userId = 'e2e-user';

    const cz = new PlannerCustomization({ userId, history, now: stubNow });
    const preview = cz.previewProposal(cz.defaults, agendaProposal, {
      simulated: true,
      providerId: 'test-double',
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const applied = await cz.apply(cz.defaults, preview.preview.view, 'agenda');
    expect(applied.ok).toBe(true);

    // New service instance + new git-backed store over the same IndexedDB = reload.
    const reloadedHistory = new BrowserReposHistoryStore();
    const cz2 = new PlannerCustomization({ userId, history: reloadedHistory, now: stubNow });
    const reopened = await cz2.reopen();
    expect(reopened.usedFallback).toBe(false);
    expect(reopened.view.components.map((c) => c.componentId)).toContain('agenda');
    expect(
      reopened.view.controls.some((c) => c.controlId === PlannerControls.CompleteTask),
    ).toBe(true);
  });
});

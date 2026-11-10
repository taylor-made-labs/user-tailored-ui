/**
 * Pin check: the vendored browser-repos tarball must be built from browser-repos main
 * (slices 6/7). `GitHubSyncTarget` and `redactCredentials` ship only in the slice-7
 * build; the older 369ab3d (slice 5) tarball lacked them.
 */
import { describe, it, expect } from 'vitest';
import { GitHubSyncTarget, redactCredentials } from '@taylor-made-labs/browser-repos';

describe('vendored browser-repos pin', () => {
  it('exports the slice 6/7 surface', () => {
    expect(typeof GitHubSyncTarget).toBe('function');
    expect(typeof redactCredentials).toBe('function');
  });
});

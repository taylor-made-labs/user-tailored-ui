#!/usr/bin/env node
/**
 * LABELED LIVE SMOKE TEST — Claude subscription path (NOT run in CI).
 *
 * This proves the REAL subscription-authenticated path end to end:
 *   your `claude` CLI OAuth login -> Agent SDK `query()` -> a JSON proposal.
 *
 * It is intentionally OUTSIDE `test/` and written in plain `.mjs`, so it is
 * invisible to typecheck (`tsconfig` includes only `src`/`test`), lint
 * (`eslint --ext .ts,.tsx`), and the CI test suite (vitest `test/**`). CI stays
 * deterministic, keyless, and login-free; the deterministic test-double remains
 * the CI default and the adapter's mapping logic is covered by the mocked unit
 * tests in `test/agent-sdk.test.ts`.
 *
 * ── One-time setup (on your machine, once) ────────────────────────────────
 *   1. Install the Claude Code CLI and sign in with your subscription:
 *        npm i -g @anthropic-ai/claude-code   # or your platform's installer
 *        claude            # then complete the OAuth login in the browser
 *      There is NO API key. This adapter uses your Claude SUBSCRIPTION via that
 *      OAuth login — no `sk-ant-` key, no per-token billing.
 *   2. Install the Agent SDK in this repo (it is an optional dependency so CI
 *      never needs it):
 *        npm i --no-save @anthropic-ai/claude-agent-sdk@0.3.318
 *
 * ── Run it ────────────────────────────────────────────────────────────────
 *        npm run smoke:claude
 *      (which is: RUN_LIVE_CLAUDE=1 node scripts/live-smoke-claude.mjs)
 *   Without RUN_LIVE_CLAUDE=1 it exits 0 immediately (skipped), so it is safe
 *   to leave wired up. It NEVER reads, prints, or stores any credential.
 *
 * Exit code 0 = proposal produced (or skipped); non-zero = the live path failed.
 */

if (process.env.RUN_LIVE_CLAUDE !== '1') {
  console.log('[live-smoke] SKIPPED — set RUN_LIVE_CLAUDE=1 to run the real subscription path.');
  process.exit(0);
}

// Guard against accidental API-key usage: this path must ride the subscription
// OAuth login, not a key. We do not read the key; we only refuse if one is set,
// so the smoke test genuinely exercises the subscription path.
if (process.env.ANTHROPIC_API_KEY) {
  console.error(
    '[live-smoke] ANTHROPIC_API_KEY is set. This smoke test verifies the SUBSCRIPTION\n' +
      '            (OAuth) path, not an API key. Unset ANTHROPIC_API_KEY and ensure you are\n' +
      '            logged in via `claude`, then re-run.',
  );
  process.exit(2);
}

/** Dynamically import the real adapter (compiled) and the real SDK. */
async function main() {
  // The adapter is pure TS; import it from source via tsx-less dynamic import is
  // not possible here, so we re-implement the tiny wiring: import the SDK's
  // `query` and feed it through the SAME structural contract the adapter uses.
  // To keep a single source of truth we instead run the built adapter if present,
  // falling back to a minimal inline driver.
  let AgentSdkInferenceAdapter;
  try {
    ({ AgentSdkInferenceAdapter } = await import('../dist/adapters/inference/agent-sdk.js'));
  } catch {
    console.error(
      '[live-smoke] Built adapter not found. Run `npm run build` first so\n' +
        '            dist/adapters/inference/agent-sdk.js exists, then re-run.',
    );
    process.exit(3);
    return;
  }

  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch (err) {
    console.error(
      '[live-smoke] @anthropic-ai/claude-agent-sdk is not installed. Install it with\n' +
        '            `npm i --no-save @anthropic-ai/claude-agent-sdk@0.3.318`, then re-run.\n' +
        '            Original error: ' +
        (err && err.message ? err.message : String(err)),
    );
    process.exit(3);
    return;
  }

  const adapter = new AgentSdkInferenceAdapter({ query, timeoutMs: 120_000 });

  const request = {
    utterance: 'turn my board into a focused daily agenda',
    surface: {
      overridableTokens: ['density', 'fontScale'],
      allowedComponents: ['board', 'agenda', 'task-card'],
      allowedActions: ['task.complete', 'task.edit', 'task.reorder'],
      currentViewSummary: 'board with task cards, comfortable density',
    },
  };

  console.log('[live-smoke] Calling the real Claude subscription path via Agent SDK query()...');
  const res = await adapter.propose(request);
  console.log('[live-smoke] providerId =', res.providerId, ' simulated =', res.simulated);
  console.log('[live-smoke] proposal   =', JSON.stringify(res.proposal, null, 2));
  if (res.simulated !== false) {
    console.error('[live-smoke] FAIL — real adapter reported simulated !== false.');
    process.exit(4);
  }
  console.log('[live-smoke] PASS — real subscription path produced a proposal.');
}

main().catch((err) => {
  // The adapter already maps failures to a typed InferenceError (.kind).
  const kind = err && err.kind ? ` [${err.kind}]` : '';
  console.error(`[live-smoke] FAIL${kind}: ${err && err.message ? err.message : String(err)}`);
  if (err && err.kind === 'auth') {
    console.error(
      '[live-smoke] Hint: this looks like an auth failure. Make sure you ran `claude` and\n' +
        '            completed the subscription OAuth login on this machine.',
    );
  }
  process.exit(1);
});

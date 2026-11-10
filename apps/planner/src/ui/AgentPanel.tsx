/**
 * The in-app agent panel (spec task 6; R3, R4, R6).
 *
 * utterance -> preview -> apply / undo, with INLINE rejection explanations that cite
 * the failed invariant, and an honest SIMULATED label whenever the preview came from
 * the labeled test-double agent (dev flag only). Every ask goes to a real model; there
 * are no canned quick picks (R2.1). Without a key, Ask is disabled and says why (R2.5).
 */

import { useState } from 'react';
import type { ApiKeyState } from './useApiKey.js';
import { BROKER_URL } from '../inference.js';
import type { PlannerState } from './usePlanner.js';
import { PlannerControls } from '../customization/policy.js';

export function AgentPanel(props: { planner: PlannerState; apiKey?: ApiKeyState }): JSX.Element {
  const { planner, apiKey } = props;
  const [keyDraft, setKeyDraft] = useState('');
  const blocked = apiKey !== undefined && !apiKey.hasKey && !BROKER_URL;
  const [utterance, setUtterance] = useState('');

  return (
    <aside
      style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 12,
        width: 320,
        flexShrink: 0,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Customize with the agent</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked && utterance.trim()) void planner.propose(utterance);
        }}
        style={{ display: 'flex', gap: 6, marginBottom: 8 }}
      >
        <input
          aria-label="Ask the agent"
          value={utterance}
          placeholder="e.g. focused daily agenda"
          onChange={(e) => setUtterance(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={blocked}>
          Ask
        </button>
      </form>

      {apiKey && (
        <div style={{ marginBottom: 8, fontSize: '0.8rem' }}>
          {apiKey.hasKey ? (
            <button type="button" onClick={() => void apiKey.clearKey()}>
              Forget API key
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void apiKey.setKey(keyDraft).then(() => setKeyDraft(''));
              }}
            >
              <p role="status" style={{ margin: '0 0 4px' }}>
                {BROKER_URL
                  ? 'Optional: use your own Anthropic key.'
                  : 'No API key. Add your Anthropic key to ask the agent.'}
              </p>
              <input
                type="password"
                autoComplete="off"
                aria-label="Anthropic API key"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
              />{' '}
              <button type="submit">Use key</button>
              {!BROKER_URL && (
                <p style={{ margin: '4px 0 0', opacity: 0.7 }}>
                  Kept in memory for this session. It is sent straight from your browser to
                  api.anthropic.com, so only use a key you can rotate.
                </p>
              )}
            </form>
          )}
        </div>
      )}
      {planner.error && (
        <div role="alert" style={{ border: '1px solid #c66', borderRadius: 6, padding: 8, marginBottom: 12, background: '#fff3f3', fontSize: '0.85rem' }}>
          {planner.error}
        </div>
      )}

      {planner.preview && (
        <div
          style={{
            border: '1px solid #8ab',
            borderRadius: 6,
            padding: 8,
            marginBottom: 12,
            background: '#f3f8ff',
          }}
        >
          <strong>Preview</strong>
          {__ENABLE_TEST_DOUBLE__ && planner.preview.simulated && (
            <span
              title="Produced by the labeled offline test-double agent, not a real model."
              style={{
                marginLeft: 6,
                fontSize: '0.7rem',
                background: '#444',
                color: '#fff',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              SIMULATED ({planner.preview.providerId})
            </span>
          )}
          <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>
            components:{' '}
            {planner.preview.view.components.map((c) => c.componentId).join(', ')}
            <br />
            density: {String(planner.preview.view.tokens.density)} · fontScale:{' '}
            {String(planner.preview.view.tokens.fontScale)}
            <br />
            complete control kept:{' '}
            {String(
              planner.preview.view.controls.some(
                (c) => c.controlId === PlannerControls.CompleteTask,
              ),
            )}
          </p>
          {planner.preview.rationale && (
            <p style={{ margin: '6px 0', fontSize: '0.8rem', opacity: 0.8 }}>
              “{planner.preview.rationale}”
            </p>
          )}
          <button onClick={() => void planner.applyPreview()}>Apply</button>{' '}
          <button onClick={planner.dismissPreview}>Dismiss</button>
        </div>
      )}

      {planner.rejection && (
        <div
          role="alert"
          style={{
            border: '1px solid #c66',
            borderRadius: 6,
            padding: 8,
            marginBottom: 12,
            background: '#fff3f3',
          }}
        >
          <strong>Rejected — the last valid view was kept.</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
            {planner.rejection.map((r, i) => (
              <li key={i}>
                <code>{r.invariant}</code> — {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>History (undo)</h3>
        {planner.history.length === 0 && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>No saved customizations yet.</p>
        )}
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem' }}>
          {planner.history.map((h) => (
            <li key={h.id}>
              {h.message}{' '}
              <button style={{ fontSize: '0.7rem' }} onClick={() => void planner.undo(h.id)}>
                undo to here
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

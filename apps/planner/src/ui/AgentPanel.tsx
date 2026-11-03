/**
 * The in-app agent panel (spec task 6; R3, R4, R6).
 *
 * utterance -> preview -> apply / undo, with INLINE rejection explanations that cite
 * the failed invariant, and an honest SIMULATED label whenever the preview came from
 * the labeled test-double agent. Quick-pick buttons let a judge trigger the valid
 * agenda transform and each of the four violation classes without typing.
 */

import { useState } from 'react';
import type { PlannerState } from './usePlanner.js';
import { PlannerControls } from '../customization/policy.js';

const QUICK_PICKS: readonly { label: string; utterance: string }[] = [
  { label: 'Focused daily agenda (valid)', utterance: 'make it a focused daily agenda' },
  { label: 'Remove complete control (reject)', utterance: 'remove complete button' },
  { label: 'Giant font 3x (reject)', utterance: 'make the font huge' },
  { label: 'Add a banner ad (reject)', utterance: 'add a banner' },
  { label: 'Enable delete-all (reject)', utterance: 'add delete all action' },
];

export function AgentPanel(props: { planner: PlannerState }): JSX.Element {
  const { planner } = props;
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
          if (utterance.trim()) void planner.propose(utterance);
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
        <button type="submit">Ask</button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {QUICK_PICKS.map((q) => (
          <button
            key={q.label}
            type="button"
            style={{ fontSize: '0.75rem' }}
            onClick={() => void planner.propose(q.utterance)}
          >
            {q.label}
          </button>
        ))}
      </div>

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
          {planner.preview.simulated && (
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

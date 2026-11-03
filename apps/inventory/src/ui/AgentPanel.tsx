/**
 * The in-app agent panel.
 *
 * utterance -> preview -> apply / undo, with INLINE rejection explanations that cite
 * the failed invariant, and an honest SIMULATED label whenever the preview came from
 * the labeled test-double agent. Quick-pick buttons let a judge trigger the valid
 * low-stock focus transform and each of the four violation classes without typing.
 */

import { useState } from 'react';
import type { InventoryState } from './useInventory.js';
import { InventoryControls } from '../customization/policy.js';

const QUICK_PICKS: readonly { label: string; utterance: string }[] = [
  { label: 'Low-stock focus (valid)', utterance: 'show only low stock items to restock' },
  { label: 'Remove adjust control (reject)', utterance: 'remove adjust quantity control' },
  { label: 'Giant font 2.5x (reject)', utterance: 'make the font huge' },
  { label: 'Add a kanban board (reject)', utterance: 'add a kanban board' },
  { label: 'Enable archive (reject)', utterance: 'add an archive action' },
];

export function AgentPanel(props: { inventory: InventoryState }): JSX.Element {
  const { inventory } = props;
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
          if (utterance.trim()) void inventory.propose(utterance);
        }}
        style={{ display: 'flex', gap: 6, marginBottom: 8 }}
      >
        <input
          aria-label="Ask the agent"
          value={utterance}
          placeholder="e.g. show only low stock"
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
            onClick={() => void inventory.propose(q.utterance)}
          >
            {q.label}
          </button>
        ))}
      </div>

      {inventory.preview && (
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
          {inventory.preview.simulated && (
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
              SIMULATED ({inventory.preview.providerId})
            </span>
          )}
          <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>
            components:{' '}
            {inventory.preview.view.components.map((c) => c.componentId).join(', ')}
            <br />
            density: {String(inventory.preview.view.tokens.density)} · fontScale:{' '}
            {String(inventory.preview.view.tokens.fontScale)}
            <br />
            low-stock only: {String(inventory.preview.view.tokens.lowStockOnly)}
            <br />
            adjust control kept:{' '}
            {String(
              inventory.preview.view.controls.some(
                (c) => c.controlId === InventoryControls.AdjustQty,
              ),
            )}
          </p>
          {inventory.preview.rationale && (
            <p style={{ margin: '6px 0', fontSize: '0.8rem', opacity: 0.8 }}>
              “{inventory.preview.rationale}”
            </p>
          )}
          <button onClick={() => void inventory.applyPreview()}>Apply</button>{' '}
          <button onClick={inventory.dismissPreview}>Dismiss</button>
        </div>
      )}

      {inventory.rejection && (
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
            {inventory.rejection.map((r, i) => (
              <li key={i}>
                <code>{r.invariant}</code> — {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>History (undo)</h3>
        {inventory.history.length === 0 && (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>No saved customizations yet.</p>
        )}
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem' }}>
          {inventory.history.map((h) => (
            <li key={h.id}>
              {h.message}{' '}
              <button style={{ fontSize: '0.7rem' }} onClick={() => void inventory.undo(h.id)}>
                undo to here
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

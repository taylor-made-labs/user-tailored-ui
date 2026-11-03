/**
 * Presentational React components. They render DATA resolved through the
 * UiCapability port — no business logic, no validation here. The grid/list/low-stock
 * layout, the density/fontScale, and the low-stock filter all come from the resolved
 * render descriptors, proving the customization actually drives presentation.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { RenderDescriptor, ViewDescriptor } from '../ports/foundation.js';
import { TailoredUiCapabilityAdapter } from '../adapters/ui-capability.js';
import { InventoryComponents, InventoryControls } from '../customization/policy.js';
import { isLowStock, sortItems, type Item } from '../domain/item.js';

const capability = new TailoredUiCapabilityAdapter();

function propNumber(desc: RenderDescriptor | null, key: string, fallback: number): number {
  const v = desc?.resolvedProps[key];
  return typeof v === 'number' ? v : fallback;
}

function propString(desc: RenderDescriptor | null, key: string, fallback: string): string {
  const v = desc?.resolvedProps[key];
  return typeof v === 'string' ? v : fallback;
}

function propBool(desc: RenderDescriptor | null, key: string, fallback: boolean): boolean {
  const v = desc?.resolvedProps[key];
  return typeof v === 'boolean' ? v : fallback;
}

export interface ItemListProps {
  readonly view: ViewDescriptor;
  readonly items: readonly Item[];
  readonly onAdjust: (id: string, delta: number) => void;
  readonly onEditName: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
}

/**
 * Renders the current item collection using whichever container component the view
 * selected (grid / list / low-stock-view) and the item-card tokens. The adjust-qty
 * control is rendered per item; it is a policy-required control, so the view can
 * never remove it. When the low-stock filter is on, healthy items are hidden from
 * view (their ids remain in the business store, untouched).
 */
export function ItemList(props: ItemListProps): JSX.Element {
  const { view, items } = props;
  const container =
    view.components.find((c) => c.componentId === InventoryComponents.LowStockView) ??
    view.components.find((c) => c.componentId === InventoryComponents.List) ??
    view.components.find((c) => c.componentId === InventoryComponents.Grid) ??
    { componentId: InventoryComponents.Grid };
  const containerDesc = capability.resolve(container, view.tokens);
  const cardDesc = capability.resolve(
    { componentId: InventoryComponents.ItemCard },
    view.tokens,
  );

  const layout = propString(containerDesc, 'layout', 'grid');
  const lowStockOnly = propBool(containerDesc, 'lowStockOnly', false);
  const density = propString(cardDesc, 'density', 'comfortable');
  const fontScale = propNumber(cardDesc, 'fontScale', 1);
  const hasAdjustControl = view.controls.some(
    (c) => c.controlId === InventoryControls.AdjustQty,
  );

  const gap = density === 'compact' ? 4 : 12;
  const ordered = sortItems(items);
  const visible = lowStockOnly ? ordered.filter((it) => isLowStock(it)) : ordered;
  const hiddenCount = ordered.length - visible.length;

  const containerStyle: CSSProperties = {
    display: layout === 'grid' ? 'grid' : 'flex',
    flexDirection: 'column',
    gap,
    fontSize: `${fontScale}rem`,
  };
  if (layout === 'grid') {
    containerStyle.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
  }

  return (
    <>
      {lowStockOnly && (
        <p data-lowstock-banner style={{ margin: '0 0 8px', fontSize: '0.85rem', opacity: 0.8 }}>
          Low-stock focus: showing {visible.length} at/below threshold
          {hiddenCount > 0 ? `, ${hiddenCount} healthy item(s) hidden` : ''}.
        </p>
      )}
      <div data-layout={layout} style={containerStyle}>
        {visible.length === 0 && (
          <p style={{ opacity: 0.6 }}>
            {lowStockOnly ? 'No low-stock items. Everything is healthy.' : 'No items yet. Add one above.'}
          </p>
        )}
        {visible.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            density={density}
            showAdjust={hasAdjustControl}
            onAdjust={props.onAdjust}
            onEditName={props.onEditName}
            onDelete={props.onDelete}
          />
        ))}
      </div>
    </>
  );
}

interface ItemCardProps {
  readonly item: Item;
  readonly density: string;
  readonly showAdjust: boolean;
  readonly onAdjust: (id: string, delta: number) => void;
  readonly onEditName: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
}

function ItemCard(props: ItemCardProps): JSX.Element {
  const { item, density, showAdjust } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const pad = density === 'compact' ? '6px 8px' : '12px 14px';
  const low = isLowStock(item);

  return (
    <div
      data-item-id={item.id}
      data-low-stock={low}
      style={{
        border: `1px solid ${low ? '#e0a94f' : '#ccc'}`,
        borderRadius: 6,
        padding: pad,
        background: low ? '#fff8ec' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft.trim() && draft !== item.name) props.onEditName(item.id, draft);
              else setDraft(item.name);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            style={{ flex: 1 }}
          />
        ) : (
          <span
            style={{ flex: 1, fontWeight: 600, cursor: 'text' }}
            onDoubleClick={() => {
              setDraft(item.name);
              setEditing(true);
            }}
          >
            {item.name}
          </span>
        )}
        <button
          aria-label={`Delete ${item.name}`}
          data-action="item.delete"
          onClick={() => props.onDelete(item.id)}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
        {item.location || 'no location'} · threshold {item.lowStockThreshold}
        {low && <span style={{ color: '#a60', marginLeft: 6 }}>LOW</span>}
      </div>

      {showAdjust && (
        <div
          data-control={InventoryControls.AdjustQty}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <button
            aria-label={`Decrease ${item.name} quantity`}
            onClick={() => props.onAdjust(item.id, -1)}
          >
            −
          </button>
          <span aria-label={`${item.name} quantity`} style={{ minWidth: 28, textAlign: 'center' }}>
            {item.quantity}
          </span>
          <button
            aria-label={`Increase ${item.name} quantity`}
            onClick={() => props.onAdjust(item.id, +1)}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export interface AddItemProps {
  readonly onAdd: (input: { name: string; quantity: number; location: string; lowStockThreshold: number }) => void;
}

export function AddItem(props: AddItemProps): JSX.Element {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [location, setLocation] = useState('');
  const [threshold, setThreshold] = useState('0');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        props.onAdd({
          name,
          quantity: Number(quantity) || 0,
          location,
          lowStockThreshold: Number(threshold) || 0,
        });
        setName('');
        setQuantity('0');
        setLocation('');
        setThreshold('0');
      }}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
    >
      <input
        aria-label="New item name"
        data-control={InventoryControls.AddItem}
        value={name}
        placeholder="Item name…"
        onChange={(e) => setName(e.target.value)}
        style={{ flex: '2 1 160px' }}
      />
      <input
        aria-label="Quantity"
        type="number"
        min={0}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ flex: '1 1 70px' }}
      />
      <input
        aria-label="Location"
        value={location}
        placeholder="Location…"
        onChange={(e) => setLocation(e.target.value)}
        style={{ flex: '1 1 120px' }}
      />
      <input
        aria-label="Low-stock threshold"
        type="number"
        min={0}
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
        style={{ flex: '1 1 90px' }}
      />
      <button type="submit">Add</button>
    </form>
  );
}

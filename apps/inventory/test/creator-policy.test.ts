import { describe, expect, it } from 'vitest';
import { inventoryPolicy } from '../src/customization/policy.js';

describe('inventory creator-policy.json', () => {
  it('loads to the same policy the TS object used to define (R4.1)', () => {
    expect(inventoryPolicy).toEqual({
      version: '1.0.0',
      allowedActions: ['item.create', 'item.edit', 'item.adjustQty', 'item.delete'],
      requiredControls: ['adjust-qty'],
      allowedComponents: ['grid', 'list', 'low-stock-view', 'item-card'],
      tokenRules: {
        fontScale: { kind: 'number', min: 1, max: 2 },
        density: { kind: 'enum', values: ['compact', 'comfortable'] },
        lowStockOnly: { kind: 'boolean' },
      },
    });
  });
});

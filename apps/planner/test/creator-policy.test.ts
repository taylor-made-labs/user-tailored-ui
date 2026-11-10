import { describe, expect, it } from 'vitest';
import { plannerPolicy } from '../src/customization/policy.js';

describe('planner creator-policy.json', () => {
  it('loads to the same policy the TS object used to define (R4.1)', () => {
    expect(plannerPolicy).toEqual({
      version: '1.0.0',
      allowedActions: ['task.create', 'task.edit', 'task.reorder', 'task.complete'],
      requiredControls: ['complete-task'],
      allowedComponents: ['board', 'agenda', 'task-card'],
      tokenRules: {
        fontScale: { kind: 'number', min: 1, max: 2 },
        density: { kind: 'enum', values: ['compact', 'comfortable'] },
      },
    });
  });
});

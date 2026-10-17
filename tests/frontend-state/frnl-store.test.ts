import { describe, expect, it } from 'vitest';
import { skipoFrnlStore } from '../../src/frontend-state/store.js';

describe('Skipo FrnlTS global store', () => {
  it('is a Zustand-backed shared store for frontend semantic entities', () => {
    skipoFrnlStore.getState().registerEntity('test-primitive', {
      kind: 'primitive',
      state: 'default',
      properties: {},
    });

    skipoFrnlStore.getState().setEntityState('test-primitive', 'focused');

    expect(skipoFrnlStore.getState().entities['test-primitive'].state).toBe('focused');
  });

  it('preserves slot identity and properties when replacing an occupant', () => {
    skipoFrnlStore.getState().registerSlot('test-content', {
      id: 'test-content',
      address: 'App.content',
      occupantId: 'old',
      occupantKind: 'composite',
      properties: { scale: 1 },
    });

    skipoFrnlStore.getState().replaceSlotOccupant('test-content', {
      id: 'new',
      kind: 'primitive',
    });

    const slot = skipoFrnlStore.getState().slots['test-content'];
    expect(slot.address).toBe('App.content');
    expect(slot.properties.scale).toBe(1);
    expect(slot.occupantId).toBe('new');
  });
});

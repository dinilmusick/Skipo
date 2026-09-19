/**
 * @file state-system.test.ts
 * @description Comprehensive test suite for SKIPO_STATE system.
 * Verifies lifecycle scopes, acyclic graph, cascade destruction, and Zustand reactivity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SKIPO_STATE } from '../state/SkipoState.js';
import { LifecycleCycleError, LifecycleGraph } from '../state/LifecycleGraph.js';

describe('SKIPO_STATE & LifecycleGraph', () => {
  beforeEach(() => {
    SKIPO_STATE.clear();
  });

  it('should create and retrieve state with explicit lifecycle', () => {
    const id = SKIPO_STATE.create(
      'UserProfileComponent',
      { type: 'COMPONENT', targetId: 'UserProfileComponent' },
      { name: 'Alice', theme: 'dark' },
      'user_profile'
    );

    expect(id).toBe('user_profile');
    const val = SKIPO_STATE.get<{ name: string; theme: string }>('user_profile');
    expect(val).toEqual({ name: 'Alice', theme: 'dark' });
  });

  it('should update state and notify subscribers via Zustand', () => {
    SKIPO_STATE.create('Counter', { type: 'APP' }, { count: 0 }, 'counter_state');

    let notifiedValue: any = null;
    const unsub = SKIPO_STATE.subscribe('counter_state', (val) => {
      notifiedValue = val;
    });

    SKIPO_STATE.set('counter_state', { count: 5 });
    expect(SKIPO_STATE.get('counter_state')).toEqual({ count: 5 });
    expect(notifiedValue).toEqual({ count: 5 });

    SKIPO_STATE.update('counter_state', (prev: any) => ({ count: prev.count + 1 }));
    expect(SKIPO_STATE.get('counter_state')).toEqual({ count: 6 });
    expect(notifiedValue).toEqual({ count: 6 });

    unsub();
  });

  it('should reject cyclic lifecycle dependencies', () => {
    const graph = new LifecycleGraph();
    graph.addDependency('stateA', 'stateB');
    graph.addDependency('stateB', 'stateC');

    expect(() => {
      graph.addDependency('stateC', 'stateA');
    }).toThrow(LifecycleCycleError);
  });

  it('should cascade destroy dependent states when parent scope is destroyed', () => {
    // Parent page
    const pageScope = 'Page_Dashboard';
    // State 1 depends on Page
    const s1 = SKIPO_STATE.create('Page', { type: 'PAGE', targetId: pageScope }, { title: 'Dash' }, 's1');
    // State 2 depends on State 1
    const s2 = SKIPO_STATE.create('Card', { type: 'STATE_DEPENDENCY', targetId: 's1' }, { count: 42 }, 's2');

    expect(SKIPO_STATE.get('s1')).toBeDefined();
    expect(SKIPO_STATE.get('s2')).toBeDefined();

    // Destroy page scope
    SKIPO_STATE.destroy(pageScope);

    // Both dependent states should be removed from Zustand
    expect(SKIPO_STATE.get('s1')).toBeUndefined();
    expect(SKIPO_STATE.get('s2')).toBeUndefined();
  });

  it('should bind and unbind dynamic lifecycle targets', () => {
    SKIPO_STATE.create('Item', { type: 'APP' }, { active: true }, 'item_state');
    SKIPO_STATE.bind('item_state', 'ParentModal');

    const desc = SKIPO_STATE.getAllEntries()['item_state'];
    expect(desc.dependencies).toContain('ParentModal');

    SKIPO_STATE.unbind('item_state', 'ParentModal');
    const updatedDesc = SKIPO_STATE.getAllEntries()['item_state'];
    expect(updatedDesc.dependencies).not.toContain('ParentModal');
  });
});

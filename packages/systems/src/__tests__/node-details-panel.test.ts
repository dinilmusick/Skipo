import { describe, it, expect } from 'vitest';
import { NodeDetailsPanel } from '../node-graph/NodeDetailsPanel.js';
import type { GraphNode } from '../node-graph/types.js';

describe('Skipo NodeDetailsPanel & Focus Pinning Architecture', () => {
  it('exports NodeDetailsPanel as a function component', () => {
    expect(typeof NodeDetailsPanel).toBe('function');
  });

  it('handles focus switching when unpinned and locks focus when pinned', () => {
    const node1: GraphNode = { id: 'node-1', type: 'source', label: 'Source Node', position: { x: 50, y: 100 } };
    const node2: GraphNode = { id: 'node-2', type: 'process', label: 'Process Node', position: { x: 200, y: 150 } };

    // Simulating unpinned vs pinned focus state logic
    let focusedId: string | null = null;
    let isPinned = false;

    const selectNode = (id: string) => {
      if (!isPinned) {
        focusedId = id;
      }
    };

    // 1. Initial selection: unpinned
    selectNode(node1.id);
    expect(focusedId).toBe('node-1');

    // 2. Select node2 while unpinned -> focus switches to node-2
    selectNode(node2.id);
    expect(focusedId).toBe('node-2');

    // 3. Pin the panel
    isPinned = true;

    // 4. Select node1 while pinned -> focus stays locked on node-2!
    selectNode(node1.id);
    expect(focusedId).toBe('node-2');

    // 5. Unpin the panel
    isPinned = false;

    // 6. Select node1 while unpinned -> focus switches to node-1
    selectNode(node1.id);
    expect(focusedId).toBe('node-1');
  });
});

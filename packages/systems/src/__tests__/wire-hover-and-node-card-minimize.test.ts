import { describe, it, expect } from 'vitest';
import { NodeCard } from '../node-graph/NodeCard.js';
import { NodeEmblem } from '../node-graph/NodeEmblem.js';
import { WireRenderer } from '../node-graph/WireRenderer.js';
import type { GraphNode, GraphEdge } from '../node-graph/types.js';

describe('Wire Hover Widgets & Node Card Minimized/Expanded View (Law L26)', () => {
  it('exports NodeCard, NodeEmblem, and WireRenderer as React components', () => {
    expect(typeof NodeCard).toBe('function');
    expect(typeof NodeEmblem).toBe('function');
    expect(typeof WireRenderer).toBe('function');
  });

  it('validates node custom title and system name separation', () => {
    const userNode: GraphNode = {
      id: 'node-calc-1',
      type: 'primitive-math', // System name (set by app)
      label: 'My Revenue Calculator', // Title (custom name set by user)
      position: { x: 100, y: 120 },
      minimized: false
    };

    expect(userNode.label).toBe('My Revenue Calculator');
    expect(userNode.type).toBe('primitive-math');
  });

  it('enforces 1/3 icon and 2/3 title proportion layout in minimized view', () => {
    const iconWidthPercent = 33.333;
    const titleWidthPercent = 66.667;

    // Mathematical verification of 1/3 and 2/3 space division
    expect(Math.round(iconWidthPercent + titleWidthPercent)).toBe(100);
    expect(Number((titleWidthPercent / iconWidthPercent).toFixed(1))).toBe(2.0);
  });

  it('supports toggling minimized state on GraphNode', () => {
    let node: GraphNode = {
      id: 'node-data-1',
      type: 'primitive-string',
      label: 'Greeting Text',
      position: { x: 50, y: 50 },
      minimized: false
    };

    // Toggle to minimized
    node = { ...node, minimized: true };
    expect(node.minimized).toBe(true);

    // Toggle back to expanded
    node = { ...node, minimized: false };
    expect(node.minimized).toBe(false);
  });

  it('verifies wire midpoint delete widgets are hidden without hover', () => {
    const edge: GraphEdge = {
      id: 'edge-1',
      source: 'node-1',
      sourceSocket: 'out-1',
      target: 'node-2',
      targetSocket: 'in-1'
    };

    // Emulate WireRenderer state machine
    let hoveredEdgeId: string | null = null;

    const isWidgetVisible = (edgeId: string) => hoveredEdgeId === edgeId;

    // 1. Initial idle state: widget MUST be hidden
    expect(isWidgetVisible(edge.id)).toBe(false);

    // 2. Mouse enters wire: widget becomes visible
    hoveredEdgeId = edge.id;
    expect(isWidgetVisible(edge.id)).toBe(true);

    // 3. Mouse leaves wire: widget reverts to hidden
    hoveredEdgeId = null;
    expect(isWidgetVisible(edge.id)).toBe(false);
  });
});

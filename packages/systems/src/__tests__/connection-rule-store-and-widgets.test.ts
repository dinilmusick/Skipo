import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConnectionRuleStore,
  DataHandle,
  getBeamPoints,
  type NodeDefinition
} from '../node-graph/index.js';

describe('Skipo Magnetic Node Graph — ConnectionRuleStore & UX Invariants', () => {
  beforeEach(() => {
    ConnectionRuleStore.clear();
    ConnectionRuleStore.initializeDefaults();
  });

  it('correctly reports canConnect through central store', () => {
    const source = new DataHandle({ id: 'out-1', nodeId: 'node-a', dataType: 'STRING', direction: 'OUTPUT' });
    const target = new DataHandle({ id: 'in-1', nodeId: 'node-b', dataType: 'STRING', direction: 'INPUT' });
    const incompatible = new DataHandle({ id: 'in-2', nodeId: 'node-c', dataType: 'NUMBER', direction: 'INPUT' });

    expect(ConnectionRuleStore.canConnect(source, target)).toBe(true);
    expect(ConnectionRuleStore.canConnect(source, incompatible)).toBe(false);
  });

  it('filters node types to only compatible ones when dragging from handle', () => {
    const sampleNodes: NodeDefinition[] = [
      {
        type: 'text_processor',
        label: 'Text Processor',
        inputs: [{ id: 'in-txt', dataType: 'STRING', category: 'DATA', direction: 'INPUT', connectionMode: 'SINGLE' }],
        outputs: [{ id: 'out-txt', dataType: 'STRING', category: 'DATA', direction: 'OUTPUT', connectionMode: 'MULTI' }]
      },
      {
        type: 'number_multiplier',
        label: 'Number Multiplier',
        inputs: [{ id: 'in-num', dataType: 'NUMBER', category: 'DATA', direction: 'INPUT', connectionMode: 'SINGLE' }],
        outputs: [{ id: 'out-num', dataType: 'NUMBER', category: 'DATA', direction: 'OUTPUT', connectionMode: 'SINGLE' }]
      },
      {
        type: 'universal_sink',
        label: 'Universal Sink',
        inputs: [{ id: 'in-any', dataType: 'ANY', category: 'DATA', direction: 'INPUT', connectionMode: 'MULTI' }]
      }
    ];

    ConnectionRuleStore.registerNodeTypes(sampleNodes);

    // Dragging from STRING OUTPUT should return text_processor and universal_sink, but NOT number_multiplier
    const compatible = ConnectionRuleStore.getCompatibleNodeTypes(
      { dataType: 'STRING', direction: 'OUTPUT' },
      sampleNodes
    );

    const types = compatible.map(n => n.type);
    expect(types).toContain('text_processor');
    expect(types).toContain('universal_sink');
    expect(types).not.toContain('number_multiplier');
  });

  it('finds compatible sockets on a target node for auto-connection', () => {
    const targetNode: NodeDefinition = {
      type: 'mixed_node',
      label: 'Mixed Node',
      inputs: [
        { id: 'in-num', dataType: 'NUMBER', category: 'DATA', direction: 'INPUT', connectionMode: 'SINGLE' },
        { id: 'in-str', dataType: 'STRING', category: 'DATA', direction: 'INPUT', connectionMode: 'SINGLE' }
      ]
    };

    const sockets = ConnectionRuleStore.findCompatibleSockets(
      { dataType: 'STRING', direction: 'OUTPUT' },
      targetNode
    );

    expect(sockets).toHaveLength(1);
    expect(sockets[0].id).toBe('in-str');
  });

  it('calculates a tapered energy beam wide at base (node body) and narrow at head (handle)', () => {
    // When handle is displaced 50px right, 0px down from node body
    const nudge = { x: 50, y: 0 };
    const baseW = 8;  // 16px wide at node body
    const headW = 2;  // 4px wide at displaced handle

    const pointsStr = getBeamPoints(nudge, baseW, headW);
    expect(pointsStr).toBeTruthy();
    const pairs = pointsStr.split(' ');
    expect(pairs.length).toBe(4);

    // Coordinate parsing:
    // head points at (0, 0): hL and hR
    // base points at (-50, 0): bR and bL
    const coords = pairs.map(p => p.split(',').map(Number));
    const [hL, hR, bR, bL] = coords;

    // Head width (connection to handle)
    const headDistance = Math.hypot(hR[0] - hL[0], hR[1] - hL[1]);
    expect(headDistance).toBeCloseTo(headW * 2);

    // Base width (connection to node body)
    const baseDistance = Math.hypot(bR[0] - bL[0], bR[1] - bL[1]);
    expect(baseDistance).toBeCloseTo(baseW * 2);

    // Verify beam is wide at base and narrow at head
    expect(baseDistance).toBeGreaterThan(headDistance);
  });
});


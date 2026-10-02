import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionRuleStore } from '../node-graph/rules/ConnectionRuleStore.js';
import { PRIMITIVE_NODE_DEFINITIONS } from '../node-graph/domain/primitives/PrimitiveNodeDefs.js';
import { GhostInferenceEngine } from '../node-graph/spatial/prediction/GhostInferenceEngine.js';
import type { GraphNode, GraphEdge } from '../node-graph/types.js';

describe('Primitive Nodes & Magnetic Traces Governance', () => {
  beforeEach(() => {
    ConnectionRuleStore.clear();
    ConnectionRuleStore.initializeDefaults();
  });

  it('pre-registers all standard primitive nodes by default', () => {
    const nodeTypes = ConnectionRuleStore.listNodeTypes();
    expect(nodeTypes.length).toBeGreaterThanOrEqual(7);

    const types = nodeTypes.map(n => n.type);
    expect(types).toContain('primitive-number');
    expect(types).toContain('primitive-string');
    expect(types).toContain('primitive-boolean');
    expect(types).toContain('primitive-vector2');
    expect(types).toContain('primitive-color');
    expect(types).toContain('primitive-math');
    expect(types).toContain('primitive-display');
  });

  it('validates primitive connection rules for data handles', () => {
    expect(
      ConnectionRuleStore.canConnect(
        { dataType: 'NUMBER', direction: 'OUTPUT', handleCategory: 'DATA' },
        { dataType: 'NUMBER', direction: 'INPUT', handleCategory: 'DATA' }
      )
    ).toBe(true);

    expect(
      ConnectionRuleStore.canConnect(
        { dataType: 'VECTOR2', direction: 'OUTPUT', handleCategory: 'DATA' },
        { dataType: 'VECTOR2', direction: 'INPUT', handleCategory: 'DATA' }
      )
    ).toBe(true);

    expect(
      ConnectionRuleStore.canConnect(
        { dataType: 'NUMBER', direction: 'OUTPUT', handleCategory: 'DATA' },
        { dataType: 'STRING', direction: 'INPUT', handleCategory: 'DATA' }
      )
    ).toBe(false);
  });

  it('automatically predicts downstream primitive nodes via GhostInferenceEngine', () => {
    const numberNode: GraphNode = {
      id: 'num-1',
      type: 'primitive-number',
      label: 'Number',
      position: { x: 50, y: 50 },
      outputs: [
        { id: 'out', label: 'Num', type: 'output', dataType: 'NUMBER' }
      ]
    };

    const nodeDefs = ConnectionRuleStore.listNodeTypes();
    const candidates = GhostInferenceEngine.inferNextNodes([numberNode], nodeDefs, {
      scenarioCount: 2
    });

    expect(candidates.length).toBeGreaterThan(0);
    // Downstream suggestions should include Math or Display
    const candidateTypes = candidates.map(c => c.nodeType);
    expect(candidateTypes.some(t => t === 'primitive-math' || t === 'primitive-display' || t === 'primitive-vector2')).toBe(true);
  });
});

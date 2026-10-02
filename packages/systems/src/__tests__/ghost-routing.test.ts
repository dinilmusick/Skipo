import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionRuleStore } from '../node-graph/rules/ConnectionRuleStore.js';
import { GhostInferenceEngine } from '../node-graph/spatial/prediction/GhostInferenceEngine.js';
import { GhostLayoutResolver } from '../node-graph/spatial/prediction/GhostLayoutResolver.js';
import { GhostTracePathBuilder } from '../node-graph/spatial/prediction/GhostTracePathBuilder.js';
import { GhostStore } from '../node-graph/store/GhostStore.js';
import type { GraphNode } from '../node-graph/types.js';
import type { NodeDefinition } from '../node-graph/domain/BaseNode.js';

describe('Predictive Node Graph Completion System (Ghost Routing)', () => {
  beforeEach(() => {
    ConnectionRuleStore.initializeDefaults();
    GhostStore.getInstance().clear();
  });

  const sampleNodes: GraphNode[] = [
    {
      id: 'src-1',
      type: 'audio_source',
      label: 'Audio In',
      position: { x: 100, y: 150 },
      width: 180,
      height: 120,
      outputs: [
        { id: 'out-1', label: 'Audio', type: 'output', dataType: 'AUDIO' }
      ]
    }
  ];

  const nodeDefs: NodeDefinition[] = [
    {
      type: 'filter',
      label: 'Lowpass Filter',
      inputs: [{ id: 'in-f', category: 'DATA', dataType: 'AUDIO', direction: 'INPUT', connectionMode: 'SINGLE' }],
      outputs: [{ id: 'out-f', category: 'DATA', dataType: 'AUDIO', direction: 'OUTPUT', connectionMode: 'SINGLE' }]
    },
    {
      type: 'gain',
      label: 'Gain Control',
      inputs: [{ id: 'in-g', category: 'DATA', dataType: 'AUDIO', direction: 'INPUT', connectionMode: 'SINGLE' }],
      outputs: [{ id: 'out-g', category: 'DATA', dataType: 'AUDIO', direction: 'OUTPUT', connectionMode: 'SINGLE' }]
    },
    {
      type: 'text_viewer',
      label: 'Text Display',
      inputs: [{ id: 'in-t', category: 'DATA', dataType: 'STRING', direction: 'INPUT', connectionMode: 'SINGLE' }]
    }
  ];

  it('infers compatible downstream nodes and forms socket mappings', () => {
    const candidates = GhostInferenceEngine.inferNextNodes(sampleNodes, nodeDefs, {
      scenarioCount: 2
    });

    expect(candidates.length).toBeGreaterThan(0);
    // Should NOT match text_viewer for an AUDIO output
    expect(candidates.some(c => c.nodeType === 'text_viewer')).toBe(false);
    // Should match filter and gain
    expect(candidates.some(c => c.nodeType === 'filter')).toBe(true);

    const filterCand = candidates.find(c => c.nodeType === 'filter');
    expect(filterCand).toBeDefined();
    expect(filterCand?.socketMappings.length).toBe(1);
    expect(filterCand?.socketMappings[0].sourceSocketId).toBe('out-1');
    expect(filterCand?.socketMappings[0].targetSocketId).toBe('in-f');
  });

  it('resolves non-colliding AABB layout downstream from parent node', () => {
    const candidates = GhostInferenceEngine.inferNextNodes(sampleNodes, nodeDefs, {
      scenarioCount: 2
    });
    const layout = GhostLayoutResolver.resolveLayout(candidates, sampleNodes, nodeDefs);

    expect(layout.length).toBe(candidates.length);
    for (const ghost of layout) {
      // Must be placed to the right of the parent node
      expect(ghost.position.x).toBeGreaterThanOrEqual(sampleNodes[0].position.x + 180);
      expect(ghost.size.width).toBe(180);
      expect(ghost.size.height).toBe(120);
    }
  });

  it('builds SVG Bézier curves for ghost traces', () => {
    const candidates = GhostInferenceEngine.inferNextNodes(sampleNodes, nodeDefs, { scenarioCount: 1 });
    const layout = GhostLayoutResolver.resolveLayout(candidates, sampleNodes, nodeDefs);
    const traces = GhostTracePathBuilder.buildGhostTraces(layout, sampleNodes);

    expect(traces.length).toBeGreaterThan(0);
    for (const trace of traces) {
      expect(trace.pathD).toMatch(/^M \d+(\.\d+)?,/);
      expect(trace.pathD).toContain(' C ');
      expect(trace.sourceNodeId).toBe('src-1');
    }
  });

  it('maintains decoupled ephemeral state in GhostStore', () => {
    const store = GhostStore.getInstance();
    expect(store.isActive).toBe(false);

    const candidates = GhostInferenceEngine.inferNextNodes(sampleNodes, nodeDefs, { scenarioCount: 2 });
    const layout = GhostLayoutResolver.resolveLayout(candidates, sampleNodes, nodeDefs);
    const traces = GhostTracePathBuilder.buildGhostTraces(layout, sampleNodes);

    store.setPredictions(layout, traces, ['src-1']);
    expect(store.isActive).toBe(true);
    expect(store.scenarioIndex).toBe(0);

    const activeNodes = store.getActiveGhostNodes();
    expect(activeNodes.every(n => n.scenarioIndex === 0)).toBe(true);

    store.cycleScenario(2);
    expect(store.scenarioIndex).toBe(1);

    store.clear();
    expect(store.isActive).toBe(false);
    expect(store.ghostNodes.length).toBe(0);
    expect(store.ghostTraces.length).toBe(0);
  });
});

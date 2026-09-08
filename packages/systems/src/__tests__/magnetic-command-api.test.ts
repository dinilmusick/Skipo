import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphStore,
  CommandApi,
  DataHandle,
  ReactFlowAdapter,
  initializeDefaultGraphRules,
  CompatibilityMatrix
} from '../node-graph/index.js';

describe('Skipo Magnetic Node Graph — Command API & ReactFlowAdapter', () => {
  let store: GraphStore;
  let api: CommandApi;

  beforeEach(() => {
    CompatibilityMatrix.clear();
    initializeDefaultGraphRules();
    store = new GraphStore();
    api = new CommandApi(store);
  });

  it('creates and moves nodes via Command API while recalculating traces', () => {
    const nodeA = api.nodes.create({
      id: 'a',
      type: 'source',
      position: { x: 0, y: 0 },
      handles: [new DataHandle({ id: 'out-a', nodeId: 'a', dataType: 'NUMBER', direction: 'OUTPUT' })]
    });

    const nodeB = api.nodes.create({
      id: 'b',
      type: 'sink',
      position: { x: 100, y: 0 },
      handles: [new DataHandle({ id: 'in-b', nodeId: 'b', dataType: 'NUMBER', direction: 'INPUT' })]
    });

    expect(store.traces.length).toBe(1);

    // Move nodeB out of trace cutoff (e.g. 500px)
    api.nodes.move('b', 500, 0);
    expect(store.traces.length).toBe(0);

    // Move nodeB back within cutoff
    api.nodes.move('b', 80, 0);
    expect(store.traces.length).toBe(1);
  });

  it('solidifies a trace manually into a SolidConnection', () => {
    api.nodes.create({
      id: 'a',
      type: 'source',
      position: { x: 0, y: 0 },
      handles: [new DataHandle({ id: 'out-a', nodeId: 'a', dataType: 'NUMBER', direction: 'OUTPUT' })]
    });

    api.nodes.create({
      id: 'b',
      type: 'sink',
      position: { x: 50, y: 0 },
      handles: [new DataHandle({ id: 'in-b', nodeId: 'b', dataType: 'NUMBER', direction: 'INPUT' })]
    });

    expect(store.traces.length).toBe(1);
    const traceId = store.traces[0].id;

    const conn = api.traces.solidify(traceId);
    expect(conn).toBeDefined();
    expect(store.connections.length).toBe(1);
    expect(store.connections[0].sourceNodeId).toBe('a');
    expect(store.connections[0].targetNodeId).toBe('b');
  });

  it('translates core graph domain structures to React Flow compatible representations', () => {
    const node = api.nodes.create({
      id: 'rf-node',
      type: 'transformer',
      position: { x: 200, y: 300 },
      handles: [
        new DataHandle({ id: 'h1', nodeId: 'rf-node', dataType: 'STRING', direction: 'INPUT' })
      ]
    });

    const rfNodes = ReactFlowAdapter.toReactFlowNodes([node]);
    expect(rfNodes.length).toBe(1);
    expect(rfNodes[0].id).toBe('rf-node');
    expect(rfNodes[0].type).toBe('magneticNode');
    expect(rfNodes[0].position).toEqual({ x: 200, y: 300 });
    expect(rfNodes[0].data.handles[0].dataType).toBe('STRING');
  });
});

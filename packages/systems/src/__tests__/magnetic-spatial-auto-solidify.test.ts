import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomNode,
  DataHandle,
  SolidConnection,
  SpatialEngine,
  TraceEngine,
  AutoSolidify,
  AttractionEngine,
  CompatibilityMatrix,
  initializeDefaultGraphRules
} from '../node-graph/index.js';

describe('Skipo Magnetic Node Graph — Spatial Tracing, Offsets & Auto-Solidify', () => {
  beforeEach(() => {
    CompatibilityMatrix.clear();
    initializeDefaultGraphRules();
  });

  it('incorporates handle offsets into effective handle positions', () => {
    const node = new CustomNode({ id: 'node-1', type: 'source', position: { x: 100, y: 100 } });
    const handle = new DataHandle({
      id: 'h1',
      nodeId: 'node-1',
      dataType: 'NUMBER',
      direction: 'OUTPUT',
      basePosition: { x: 50, y: 20 },
      offset: { x: 10, y: -5 }
    });

    const effective = SpatialEngine.calculateEffectiveHandlePosition(node, handle);
    expect(effective.x).toBe(160); // 100 + 50 + 10
    expect(effective.y).toBe(115); // 100 + 20 - 5
  });

  it('generates transient traces for compatible handles within cutoff distance', () => {
    const nodeA = new CustomNode({ id: 'node-a', type: 'src', position: { x: 0, y: 0 } });
    const handleA = new DataHandle({ id: 'out-a', nodeId: 'node-a', dataType: 'NUMBER', direction: 'OUTPUT' });
    nodeA.addHandle(handleA);

    const nodeB = new CustomNode({ id: 'node-b', type: 'tgt', position: { x: 100, y: 0 } });
    const handleB = new DataHandle({ id: 'in-b', nodeId: 'node-b', dataType: 'NUMBER', direction: 'INPUT' });
    nodeB.addHandle(handleB);

    const nodeFar = new CustomNode({ id: 'node-far', type: 'tgt', position: { x: 1000, y: 0 } });
    const handleFar = new DataHandle({ id: 'in-far', nodeId: 'node-far', dataType: 'NUMBER', direction: 'INPUT' });
    nodeFar.addHandle(handleFar);

    const traces = TraceEngine.computeTraces([nodeA, nodeB, nodeFar], 200);
    expect(traces.length).toBe(1);
    expect(traces[0].sourceNodeId).toBe('node-a');
    expect(traces[0].targetNodeId).toBe('node-b');
  });

  it('resolves single-endpoint candidate competition spatially (closest wins)', () => {
    const sourceNode = new CustomNode({ id: 'node-src', type: 'src', position: { x: 0, y: 0 } });
    sourceNode.addHandle(new DataHandle({ id: 'out-1', nodeId: 'node-src', dataType: 'STRING', direction: 'OUTPUT', connectionMode: 'SINGLE' }));

    // Target 1: further away (x: 300, distance ~96)
    const target1 = new CustomNode({ id: 'node-t1', type: 'tgt', position: { x: 300, y: 0 } });
    target1.addHandle(new DataHandle({ id: 'in-1', nodeId: 'node-t1', dataType: 'STRING', direction: 'INPUT', connectionMode: 'SINGLE' }));

    // Target 2: closer (x: 230, distance ~26)
    const target2 = new CustomNode({ id: 'node-t2', type: 'tgt', position: { x: 230, y: 0 } });
    target2.addHandle(new DataHandle({ id: 'in-2', nodeId: 'node-t2', dataType: 'STRING', direction: 'INPUT', connectionMode: 'SINGLE' }));

    const traces = TraceEngine.computeTraces([sourceNode, target1, target2], 200);
    const resolved = AutoSolidify.resolve([sourceNode, target1, target2], traces, []);

    expect(resolved.length).toBe(1);
    expect(resolved[0].targetNodeId).toBe('node-t2'); // Closer target won!
  });

  it('preserves locked connections against spatial replacement', () => {
    const sourceNode = new CustomNode({ id: 'node-src', type: 'src', position: { x: 0, y: 0 } });
    sourceNode.addHandle(new DataHandle({ id: 'out-1', nodeId: 'node-src', dataType: 'STRING', direction: 'OUTPUT', connectionMode: 'SINGLE' }));

    const target1 = new CustomNode({ id: 'node-t1', type: 'tgt', position: { x: 100, y: 0 } });
    target1.addHandle(new DataHandle({ id: 'in-1', nodeId: 'node-t1', dataType: 'STRING', direction: 'INPUT', connectionMode: 'SINGLE' }));

    const lockedConn = new SolidConnection({
      id: 'conn-locked',
      sourceNodeId: 'node-src',
      sourceHandleId: 'out-1',
      targetNodeId: 'node-t1',
      targetHandleId: 'in-1',
      locked: true
    });

    // Target 2 is closer (30px), but source's single output is LOCKED to target1!
    const target2 = new CustomNode({ id: 'node-t2', type: 'tgt', position: { x: 30, y: 0 } });
    target2.addHandle(new DataHandle({ id: 'in-2', nodeId: 'node-t2', dataType: 'STRING', direction: 'INPUT', connectionMode: 'SINGLE' }));

    const traces = TraceEngine.computeTraces([sourceNode, target1, target2], 200);
    const resolved = AutoSolidify.resolve([sourceNode, target1, target2], traces, [lockedConn]);

    expect(resolved.length).toBe(1);
    expect(resolved[0].id).toBe('conn-locked');
    expect(resolved[0].targetNodeId).toBe('node-t1');
  });

  it('clusters similar nodes during attraction step and leaves position-locked nodes intact', () => {
    const nodeA = new CustomNode({ id: 'a', type: 'math', position: { x: 0, y: 0 } });
    const nodeB = new CustomNode({ id: 'b', type: 'math', position: { x: 100, y: 0 }, positionLocked: true });

    const step = AttractionEngine.calculateStep([nodeA, nodeB], 1.0, 1.0);
    const posA = step.get('a')!;
    const posB = step.get('b')!;

    expect(posA.x).toBeGreaterThan(0); // Moved towards nodeB!
    expect(posB.x).toBe(100); // Remained locked!
  });
});

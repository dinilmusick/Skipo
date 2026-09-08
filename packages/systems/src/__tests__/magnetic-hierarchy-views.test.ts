import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GRAPH_SETTINGS,
  GroupSettingsResolver,
  LandmarkManager,
  ViewEngine,
  ViewWindowManager,
  CustomNode,
  DataHandle
} from '../node-graph/index.js';

describe('Skipo Magnetic Node Graph — Hierarchy, Views, Landmarks & ViewWindows', () => {
  it('hierarchically resolves group settings overrides', () => {
    const root = { ...DEFAULT_GRAPH_SETTINGS, autoSolidify: false, traceCutoffDistance: 250 };

    const parentGroup = {
      id: 'g-parent',
      nodeIds: [],
      childGroups: ['g-child'],
      settingsOverrides: { traceCutoffDistance: 350 },
      position: { x: 0, y: 0 },
      size: { width: 500, height: 500 }
    };

    const childGroup = {
      id: 'g-child',
      nodeIds: ['node-1'],
      childGroups: [],
      settingsOverrides: { autoSolidify: true },
      position: { x: 50, y: 50 },
      size: { width: 200, height: 200 }
    };

    const groups = [parentGroup, childGroup];

    // Child group node resolves: autoSolidify from childGroup (true), traceCutoffDistance from parentGroup (350), attractionEnabled from root (false)
    const autoSol = GroupSettingsResolver.resolveEffectiveSetting('autoSolidify', root, undefined, 'g-child', groups);
    const cutoff = GroupSettingsResolver.resolveEffectiveSetting('traceCutoffDistance', root, undefined, 'g-child', groups);
    const attraction = GroupSettingsResolver.resolveEffectiveSetting('attractionEnabled', root, undefined, 'g-child', groups);

    expect(autoSol).toBe(true);
    expect(cutoff).toBe(350);
    expect(attraction).toBe(false);
  });

  it('manages landmarks and anchors navigation points', () => {
    const lm = new LandmarkManager();
    const l1 = lm.createLandmark(1, 'Origin Area', { x: 0, y: 0 }, 1.0);
    const l2 = lm.createLandmark(2, 'Subsystem Cluster', { x: 500, y: 400 }, 1.5);

    expect(lm.getByNumber(1)?.name).toBe('Origin Area');
    expect(lm.getByNumber(2)?.cameraPosition.x).toBe(500);

    const list = lm.list();
    expect(list.length).toBe(2);
    expect(list[0].number).toBe(1);
    expect(list[1].number).toBe(2);
  });

  it('captures graph views with node positions, handle offsets, and camera coordinates', () => {
    const ve = new ViewEngine();
    const node = new CustomNode({ id: 'n1', type: 'src', position: { x: 120, y: 240 } });
    node.addHandle(new DataHandle({ id: 'h1', nodeId: 'n1', dataType: 'NUM', direction: 'OUTPUT', offset: { x: 15, y: -5 } }));

    const view = ve.captureView({
      name: 'Analysis Layout',
      nodes: [node],
      viewWindows: [],
      camera: { x: 100, y: 200 },
      zoom: 1.25,
      selectedNodeIds: ['n1'],
      settingsOverrides: { autoSolidify: true }
    });

    expect(view.name).toBe('Analysis Layout');
    expect(view.nodePositions['n1']).toEqual({ x: 120, y: 240 });
    expect(view.handleOffsets['n1:h1']).toEqual({ x: 15, y: -5 });
    expect(view.zoom).toBe(1.25);
    expect(view.graphSettingsOverrides.autoSolidify).toBe(true);
  });

  it('governs ViewWindow performance via DynamicState (INACTIVE, ACTIVE, PINNED_LIVE)', () => {
    const vwm = new ViewWindowManager();
    const { window: w1 } = vwm.createWindow({
      viewType: 'CODE',
      sourceNodeId: 'n1',
      sourceViewHandleId: 'vh-1',
      position: { x: 200, y: 100 }
    });

    const { window: w2 } = vwm.createWindow({
      viewType: 'UI',
      sourceNodeId: 'n1',
      sourceViewHandleId: 'vh-1',
      position: { x: 400, y: 100 }
    });

    // When w2 is created, it is selected -> w2 is ACTIVE, w1 is INACTIVE
    expect(w2.dynamicState).toBe('ACTIVE');
    expect(w1.dynamicState).toBe('INACTIVE');

    // Pin w1 live -> w1 becomes PINNED_LIVE even though w2 is selected
    vwm.pinLive(w1.id, true);
    expect(w1.dynamicState).toBe('PINNED_LIVE');
    expect(w2.dynamicState).toBe('ACTIVE');

    // Both w1 and w2 are in processing windows
    const processing = vwm.getProcessingWindows();
    expect(processing.length).toBe(2);

    // Deselect w2 -> w2 becomes INACTIVE, w1 remains PINNED_LIVE
    vwm.selectWindow('non-existent');
    expect(w2.dynamicState).toBe('INACTIVE');
    expect(w1.dynamicState).toBe('PINNED_LIVE');
    expect(vwm.getProcessingWindows().map(w => w.id)).toEqual([w1.id]);
  });
});

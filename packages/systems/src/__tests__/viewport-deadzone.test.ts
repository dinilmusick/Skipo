import { describe, it, expect } from 'vitest';
import { isNodeInCenterDeadZone, getCenterPanForNode } from '../node-graph/Viewport.js';
import type { GraphNode, ViewportState } from '../node-graph/types.js';

describe('Viewport Dead-Zone & Camera Centering Invariants', () => {
  const viewport: ViewportState = { panX: 0, panY: 0, zoom: 1 };
  const containerW = 800;
  const containerH = 600;
  // Center is at (400, 300). Dead-zone radius is 600 * 0.35 = 210px.

  it('detects a node already within the center circle (no pan needed)', () => {
    // Node centered at (400, 300) -> distance to screen center is 0 <= 210px
    const centeredNode: GraphNode = {
      id: 'node-center',
      type: 'entity',
      label: 'Centered Node',
      position: { x: 335, y: 235 }, // 335 + 65 = 400, 235 + 65 = 300
      width: 130,
      height: 130
    };

    const inDeadZone = isNodeInCenterDeadZone(centeredNode, viewport, containerW, containerH, 0.35);
    expect(inDeadZone).toBe(true);
  });

  it('detects a node near center within tolerance circle (no pan needed)', () => {
    // Node center at (480, 360) -> distance is hypot(80, 60) = 100px <= 210px
    const nearCenterNode: GraphNode = {
      id: 'node-near',
      type: 'function',
      label: 'Near Center Node',
      position: { x: 415, y: 295 }, // 415 + 65 = 480, 295 + 65 = 360
      width: 130,
      height: 130
    };

    const inDeadZone = isNodeInCenterDeadZone(nearCenterNode, viewport, containerW, containerH, 0.35);
    expect(inDeadZone).toBe(true);
  });

  it('detects a peripheral node outside the dead-zone circle (pan required)', () => {
    // Node center at (700, 500) -> distance is hypot(300, 200) = 360.5px > 210px
    const edgeNode: GraphNode = {
      id: 'node-edge',
      type: 'data',
      label: 'Peripheral Node',
      position: { x: 635, y: 435 }, // 635 + 65 = 700, 435 + 65 = 500
      width: 130,
      height: 130
    };

    const inDeadZone = isNodeInCenterDeadZone(edgeNode, viewport, containerW, containerH, 0.35);
    expect(inDeadZone).toBe(false);
  });

  it('computes exact pan coordinates that place the node in screen center', () => {
    // Node center at (700, 500)
    const edgeNode: GraphNode = {
      id: 'node-edge',
      type: 'data',
      label: 'Peripheral Node',
      position: { x: 635, y: 435 },
      width: 130,
      height: 130
    };

    const targetPan = getCenterPanForNode(edgeNode, viewport, containerW, containerH);
    // targetPanX = 400 - 700 = -300
    // targetPanY = 300 - 500 = -200
    expect(targetPan.panX).toBe(-300);
    expect(targetPan.panY).toBe(-200);

    // Verify screen position after applying targetPan
    const screenX = (edgeNode.position.x + (edgeNode.width ?? 130) / 2) * viewport.zoom + targetPan.panX;
    const screenY = (edgeNode.position.y + (edgeNode.height ?? 130) / 2) * viewport.zoom + targetPan.panY;
    expect(screenX).toBe(containerW / 2);
    expect(screenY).toBe(containerH / 2);
  });
});

import type { BaseHandle, HandlePosition } from '../domain/BaseHandle.js';
import type { BaseNode } from '../domain/BaseNode.js';

export class SpatialEngine {
  public static calculateEffectiveHandlePosition(node: BaseNode, handle: BaseHandle): HandlePosition {
    // Handle position relative to canvas: node top-left + handle basePosition + handle offset
    return {
      x: node.position.x + handle.basePosition.x + handle.offset.x,
      y: node.position.y + handle.basePosition.y + handle.offset.y
    };
  }

  public static calculateDistance(p1: HandlePosition, p2: HandlePosition): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public static calculateOffsetMagnitude(handle: BaseHandle): number {
    return Math.sqrt(handle.offset.x * handle.offset.x + handle.offset.y * handle.offset.y);
  }
}

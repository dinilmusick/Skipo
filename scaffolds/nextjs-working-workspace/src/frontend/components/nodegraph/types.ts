// ══════════════════════════════════════════════════════════════════════════════
// NODE GRAPH DOMAIN TYPES & INTERFACES (Aspect 10 Compliance)
// ══════════════════════════════════════════════════════════════════════════════

import type { Node, Edge } from '@xyflow/react';

export type NodeKind = 'SOURCE' | 'PROCESSOR' | 'SINK' | 'TRANSFORM';
export type NodeStatus = 'READY' | 'ACTIVE' | 'ERROR' | 'STANDBY';

export interface CustomNodeData {
  label: string;
  type: NodeKind;
  status: NodeStatus;
  inputs?: number;
  outputs?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type CustomNode = Node<CustomNodeData>;

export interface MouseWorldCoords {
  x: number;
  y: number;
}

export interface MarqueeBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface GraphTopology {
  nodes: Node[];
  edges: Edge[];
}

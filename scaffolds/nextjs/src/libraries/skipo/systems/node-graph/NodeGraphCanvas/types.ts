/**
 * ASCII Architecture Flowchart: types
 *
 *   ┌──────────────────────────────────────┐
 *   │           Initialize types           │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

import type { GraphNode, GraphEdge, ViewportState, NodeGraphConfig } from '../types.js';
import type { NodeDefinition } from '../domain/BaseNode.js';

// ════ NODEGRAPHCANVAS EXTRACTED TYPES ═════════════════════════════════════════════
export interface NodeGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: ViewportState;
  config?: NodeGraphConfig;
  selectedNodeIds: Set<string>;
  availableNodeTypes?: NodeDefinition[];
  onNodesChange?: (nodes: GraphNode[]) => void;
  onEdgesChange?: (edges: GraphEdge[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onViewportChange?: (viewport: ViewportState) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}
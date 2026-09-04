export interface GraphNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
  inputs?: Socket[];
  outputs?: Socket[];
  width?: number;
  height?: number;
}

export interface Socket {
  id: string;
  label: string;
  type: 'input' | 'output';
  dataType?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  sourceSocket: string;
  target: string;
  targetSocket: string;
  label?: string;
  color?: string;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface NodeGraphConfig {
  minZoom?: number;      // default 0.25
  maxZoom?: number;      // default 2.5
  gridSize?: number;     // default 20
  snapToGrid?: boolean;  // default false
  wireStyle?: 'bezier' | 'straight' | 'step';
}

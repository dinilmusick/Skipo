import * as react from 'react';
import react__default from 'react';

interface GraphNode {
    id: string;
    type: string;
    label: string;
    position: {
        x: number;
        y: number;
    };
    data?: Record<string, unknown>;
    inputs?: Socket[];
    outputs?: Socket[];
    width?: number;
    height?: number;
}
interface Socket {
    id: string;
    label: string;
    type: 'input' | 'output';
    dataType?: string;
}
interface GraphEdge {
    id: string;
    source: string;
    sourceSocket: string;
    target: string;
    targetSocket: string;
    label?: string;
    color?: string;
}
interface ViewportState {
    panX: number;
    panY: number;
    zoom: number;
}
interface NodeGraphConfig {
    minZoom?: number;
    maxZoom?: number;
    gridSize?: number;
    snapToGrid?: boolean;
    wireStyle?: 'bezier' | 'straight' | 'step';
}

/**
 * Converts screen coordinates to canvas coordinates based on the viewport.
 */
declare function screenToCanvas(clientX: number, clientY: number, viewport: ViewportState): {
    x: number;
    y: number;
};
/**
 * Converts canvas coordinates to screen coordinates based on the viewport.
 */
declare function canvasToScreen(canvasX: number, canvasY: number, viewport: ViewportState): {
    x: number;
    y: number;
};
/**
 * Zooms the viewport centered on the given mouse coordinates.
 */
declare function zoomAtPoint(mouseX: number, mouseY: number, delta: number, viewport: ViewportState, config?: NodeGraphConfig): ViewportState;
/**
 * Clamps the zoom value between the min and max allowed zoom levels.
 */
declare function clampZoom(zoom: number, config?: NodeGraphConfig): number;
/**
 * Calculates a viewport state that fits all provided nodes within the container.
 */
declare function fitToView(nodes: GraphNode[], containerWidth: number, containerHeight: number, padding?: number): ViewportState;

interface WireRendererProps {
    edges: GraphEdge[];
    nodesData: Record<string, {
        x: number;
        y: number;
        width: number;
        height: number;
        inputs: any[];
        outputs: any[];
    }>;
    config?: NodeGraphConfig;
    onDeleteEdge?: (edgeId: string) => void;
    connecting?: {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        color?: string;
    } | null;
}
declare function WireRenderer({ edges, nodesData, config: _config, onDeleteEdge, connecting }: WireRendererProps): react.JSX.Element;

interface NodeCardProps {
    node: GraphNode;
    selected?: boolean;
    onMouseDown?: (e: react__default.MouseEvent, nodeId: string) => void;
    onDoubleClick?: (nodeId: string) => void;
    onSocketMouseDown?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
}
declare function NodeCard({ node, selected, onMouseDown, onDoubleClick, onSocketMouseDown }: NodeCardProps): react__default.JSX.Element;

declare function getNodesInSelection(startX: number, startY: number, endX: number, endY: number, nodes: GraphNode[], viewport: ViewportState): string[];

declare function useNodeGraph(initialNodes?: GraphNode[], initialEdges?: GraphEdge[]): {
    nodes: GraphNode[];
    edges: GraphEdge[];
    viewport: ViewportState;
    selectedNodeIds: Set<string>;
    focusedNodeId: string | null;
    isDetailsOpen: boolean;
    isDetailsPinned: boolean;
    setNodes: react.Dispatch<react.SetStateAction<GraphNode[]>>;
    setEdges: react.Dispatch<react.SetStateAction<GraphEdge[]>>;
    setSelectedNodeIds: react.Dispatch<react.SetStateAction<Set<string>>>;
    setFocusedNodeId: react.Dispatch<react.SetStateAction<string | null>>;
    setIsDetailsOpen: react.Dispatch<react.SetStateAction<boolean>>;
    setIsDetailsPinned: react.Dispatch<react.SetStateAction<boolean>>;
    openDetails: (nodeId: string) => void;
    closeDetails: () => void;
    togglePinDetails: () => void;
    selectNode: (nodeId: string) => void;
    updateNode: (nodeId: string, updates: Partial<GraphNode>) => void;
    addNode: (node: GraphNode) => void;
    removeNode: (nodeId: string) => void;
    addEdge: (edge: GraphEdge) => void;
    removeEdge: (edgeId: string) => void;
    moveNode: (nodeId: string, x: number, y: number) => void;
    updateViewport: (updates: Partial<ViewportState>) => void;
    handleZoom: (clientX: number, clientY: number, deltaY: number, config?: NodeGraphConfig) => void;
    toJSON: () => {
        nodes: GraphNode[];
        edges: GraphEdge[];
        viewport: ViewportState;
    };
    fromJSON: (data: {
        nodes: GraphNode[];
        edges: GraphEdge[];
        viewport: ViewportState;
    }) => void;
};

interface NodeGraphCanvasProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
    viewport: ViewportState;
    config?: NodeGraphConfig;
    selectedNodeIds: Set<string>;
    onNodesChange?: (nodes: GraphNode[]) => void;
    onEdgesChange?: (edges: GraphEdge[]) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    onViewportChange?: (viewport: ViewportState) => void;
    onSelectionChange?: (selectedIds: Set<string>) => void;
}
declare function NodeGraphCanvas({ nodes, edges, viewport, config, selectedNodeIds, onNodesChange, onEdgesChange: _onEdgesChange, onNodeDoubleClick, onViewportChange, onSelectionChange }: NodeGraphCanvasProps): react__default.JSX.Element;

interface NodeDetailsPanelProps {
    node: GraphNode | null;
    isOpen: boolean;
    onClose: () => void;
    isPinned?: boolean;
    onTogglePin?: () => void;
    onUpdateNode?: (nodeId: string, updates: Partial<GraphNode>) => void;
    storageKey?: string;
}
declare function NodeDetailsPanel({ node, isOpen, onClose, isPinned, onTogglePin, onUpdateNode, storageKey }: NodeDetailsPanelProps): react.JSX.Element | null;

export { type GraphEdge, type GraphNode, NodeCard, NodeDetailsPanel, type NodeDetailsPanelProps, NodeGraphCanvas, type NodeGraphConfig, type Socket, type ViewportState, WireRenderer, canvasToScreen, clampZoom, fitToView, getNodesInSelection, screenToCanvas, useNodeGraph, zoomAtPoint };

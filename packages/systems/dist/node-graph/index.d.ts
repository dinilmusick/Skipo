import * as react from 'react';
import react__default from 'react';

type HandleCategory = 'DATA' | 'VIEW';
type HandleDirection = 'INPUT' | 'OUTPUT';
type ConnectionMode = 'SINGLE' | 'MULTI';
interface HandlePosition {
    x: number;
    y: number;
}
interface HandleOffset {
    x: number;
    y: number;
}
interface HandleDefinition {
    id: string;
    label?: string;
    category: HandleCategory;
    dataType: string;
    connectionMode: ConnectionMode;
    direction: HandleDirection;
}
interface BaseHandleProps {
    id: string;
    nodeId: string;
    direction: HandleDirection;
    dataType: string;
    connectionMode?: ConnectionMode;
    basePosition?: HandlePosition;
    offset?: HandleOffset;
    label?: string;
}
declare abstract class BaseHandle {
    id: string;
    nodeId: string;
    direction: HandleDirection;
    dataType: string;
    connectionMode: ConnectionMode;
    basePosition: HandlePosition;
    offset: HandleOffset;
    label?: string;
    abstract readonly handleCategory: HandleCategory;
    constructor(props: BaseHandleProps);
    get effectivePosition(): HandlePosition;
}
declare class DataHandle extends BaseHandle {
    readonly handleCategory: HandleCategory;
}
declare class ViewHandle extends BaseHandle {
    readonly handleCategory: HandleCategory;
    readonly icon: string;
    constructor(props: Omit<BaseHandleProps, 'dataType' | 'direction'> & {
        dataType?: string;
        direction?: HandleDirection;
    });
}

type SocketType = 'input' | 'output';
interface Socket {
    id: string;
    label: string;
    type: SocketType;
    dataType?: string;
    direction?: HandleDirection;
    offset?: {
        x: number;
        y: number;
    };
    basePosition?: {
        x: number;
        y: number;
    };
    connectionMode?: 'SINGLE' | 'MULTI';
}
interface GraphNode {
    id: string;
    type: string;
    label: string;
    position: {
        x: number;
        y: number;
    };
    size?: {
        width: number;
        height: number;
    };
    data?: Record<string, unknown>;
    inputs?: Socket[];
    outputs?: Socket[];
    width?: number;
    height?: number;
    positionLocked?: boolean;
    minimized?: boolean;
    handles?: BaseHandle[];
}
interface GraphEdge {
    id: string;
    source: string;
    sourceSocket: string;
    target: string;
    targetSocket: string;
    label?: string;
    color?: string;
    wireType?: string;
    locked?: boolean;
    deletable?: boolean;
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
    tracingEnabled?: boolean;
    magneticTracesEnabled?: boolean;
    autoSolidify?: boolean;
    traceCutoffDistance?: number;
    ghostRoutingEnabled?: boolean;
    ghostScenarioCount?: number;
    ghostDecayMs?: number;
}
interface NodeGraphPlugin {
    registerNodeDefinition?: (def: unknown) => void;
    registerHandleType?: (type: string) => void;
    registerWireType?: (wire: unknown) => void;
    registerCompatibilityRule?: (rule: unknown) => void;
    registerViewType?: (view: unknown) => void;
    registerTheme?: (theme: unknown) => void;
    registerContextMenuAction?: (action: unknown) => void;
    registerSpawnMenuItem?: (item: unknown) => void;
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
/**
 * Checks if a node's center is already within the central dead-zone circle of the viewport.
 * If true, camera should not auto-pan on selection to prevent irritating jitter.
 */
declare function isNodeInCenterDeadZone(node: GraphNode, viewport: ViewportState, containerWidth: number, containerHeight: number, deadZoneRatio?: number): boolean;
/**
 * Calculates the target pan coordinates required to center the viewport on a given node.
 */
declare function getCenterPanForNode(node: GraphNode, viewport: ViewportState, containerWidth: number, containerHeight: number): {
    panX: number;
    panY: number;
};

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
    onSocketMouseUp?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
    onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {
        x: number;
        y: number;
    }) => void;
    onToggleMinimize?: (nodeId: string, isMinimized: boolean) => void;
}
declare function NodeCard({ node, selected, onMouseDown, onDoubleClick, onSocketMouseDown, onSocketMouseUp, onSocketNudgeChange, onToggleMinimize }: NodeCardProps): react__default.JSX.Element;

interface NodeEmblemProps {
    type: string;
    size?: number;
}
declare function NodeEmblem({ type, size }: NodeEmblemProps): react.JSX.Element;

interface MovableSocketViewProps {
    nodeId: string;
    socket: Socket;
    isRight?: boolean;
    topOffset?: number;
    onMouseDown?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
    onMouseUp?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
    onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {
        x: number;
        y: number;
    }) => void;
}
declare function MovableSocketView({ nodeId, socket, isRight, topOffset, onMouseDown, onMouseUp, onSocketNudgeChange }: MovableSocketViewProps): react__default.JSX.Element;

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

interface NodePosition {
    x: number;
    y: number;
}
interface NodeSize {
    width: number;
    height: number;
}
interface NodeDefinition {
    type: string;
    label: string;
    description?: string;
    inputs?: HandleDefinition[];
    outputs?: HandleDefinition[];
    views?: string[];
    metadata?: Record<string, unknown>;
}
interface BaseNodeProps {
    id: string;
    type: string;
    label?: string;
    position: NodePosition;
    size?: NodeSize;
    handles?: BaseHandle[];
    state?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    positionLocked?: boolean;
    minimized?: boolean;
}
declare abstract class BaseNode {
    id: string;
    type: string;
    label: string;
    position: NodePosition;
    size: NodeSize;
    handles: BaseHandle[];
    state: Record<string, unknown>;
    metadata: Record<string, unknown>;
    settings: Record<string, unknown>;
    positionLocked: boolean;
    minimized: boolean;
    constructor(props: BaseNodeProps);
    getHandle(handleId: string): BaseHandle | undefined;
    addHandle(handle: BaseHandle): void;
    lockPosition(): void;
    unlockPosition(): void;
}
declare class CustomNode extends BaseNode {
    customDefinition?: NodeDefinition;
}

interface NodeGraphCanvasProps {
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
declare function NodeGraphCanvas({ nodes, edges, viewport, config, selectedNodeIds, availableNodeTypes, onNodesChange, onEdgesChange, onNodeDoubleClick, onViewportChange, onSelectionChange }: NodeGraphCanvasProps): react__default.JSX.Element;

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

interface BaseConnectionProps {
    id: string;
    sourceNodeId: string;
    sourceHandleId: string;
    targetNodeId: string;
    targetHandleId: string;
}
declare abstract class BaseConnection {
    id: string;
    sourceNodeId: string;
    sourceHandleId: string;
    targetNodeId: string;
    targetHandleId: string;
    constructor(props: BaseConnectionProps);
}
interface SolidConnectionProps extends BaseConnectionProps {
    wireType?: string;
    locked?: boolean;
    lastSignal?: unknown;
    widgets?: ('DELETE' | 'INSPECT' | 'LOCK')[];
}
declare class SolidConnection extends BaseConnection {
    wireType: string;
    locked: boolean;
    lastSignal?: unknown;
    widgets: ('DELETE' | 'INSPECT' | 'LOCK')[];
    constructor(props: SolidConnectionProps);
    toggleLock(): boolean;
}
interface ViewLinkProps {
    id: string;
    sourceNodeId: string;
    sourceViewHandleId: string;
    targetViewWindowId: string;
}
declare class ViewLink extends BaseConnection {
    sourceViewHandleId: string;
    targetViewWindowId: string;
    readonly widgets: string[];
    constructor(props: ViewLinkProps);
}

type DynamicState = 'INACTIVE' | 'ACTIVE' | 'PINNED_LIVE';
interface BaseViewWindowProps {
    id: string;
    viewType: string;
    sourceNodeId: string;
    position: NodePosition;
    size?: NodeSize;
    selected?: boolean;
    pinnedLive?: boolean;
    snapshot?: unknown;
}
declare abstract class BaseViewWindow {
    id: string;
    viewType: string;
    sourceNodeId: string;
    position: NodePosition;
    size: NodeSize;
    selected: boolean;
    pinnedLive: boolean;
    snapshot?: unknown;
    constructor(props: BaseViewWindowProps);
    get dynamicState(): DynamicState;
    setPinnedLive(pinned: boolean): void;
    setSelected(selected: boolean): void;
    captureSnapshot(data: unknown): void;
}
declare class CustomViewWindow extends BaseViewWindow {
    appSpecificContent?: unknown;
}

interface GraphSettings {
    tracingEnabled: boolean;
    autoSolidify: boolean;
    traceCutoffDistance: number;
    attractionEnabled: boolean;
    attractionSpeed: number;
    attractionStrength: number;
}
declare const DEFAULT_GRAPH_SETTINGS: GraphSettings;
interface Group {
    id: string;
    name?: string;
    nodeIds: string[];
    childGroups: string[];
    settingsOverrides: Partial<GraphSettings>;
    position: NodePosition;
    size: NodeSize;
}
interface Landmark {
    id: string;
    number: number;
    name: string;
    cameraPosition: {
        x: number;
        y: number;
    };
    zoom: number;
}
interface GraphView {
    id: string;
    name: string;
    nodePositions: Record<string, NodePosition>;
    nodeSizes: Record<string, NodeSize>;
    handleOffsets: Record<string, {
        x: number;
        y: number;
    }>;
    groupStates: Record<string, unknown>;
    viewWindows: unknown[];
    camera: {
        x: number;
        y: number;
    };
    zoom: number;
    selectedNodes: string[];
    graphSettingsOverrides: Partial<GraphSettings>;
}
declare abstract class BaseGraph {
    id: string;
    type: string;
    nodes: BaseNode[];
    connections: BaseConnection[];
    groups: Group[];
    viewWindows: BaseViewWindow[];
    landmarks: Landmark[];
    views: GraphView[];
    settings: GraphSettings;
    theme: string;
    constructor(id: string, type?: string);
}
declare class CustomGraph extends BaseGraph {
    customGraphDefinition?: Record<string, unknown>;
}

declare const PRIMITIVE_NODE_DEFINITIONS: NodeDefinition[];

interface HandleTypeDefinition {
    dataType: string;
    category: 'DATA' | 'VIEW';
    description?: string;
    color?: string;
}
declare class HandleTypeRegistry {
    private static types;
    static register(typeDef: HandleTypeDefinition): void;
    static get(dataType: string): HandleTypeDefinition | undefined;
    static has(dataType: string): boolean;
    static list(): HandleTypeDefinition[];
    static clear(): void;
}

interface WireTypeDefinition {
    wireType: string;
    color: string;
    strokeWidth: number;
    dashArray?: string;
    style?: 'bezier' | 'straight' | 'step';
    description?: string;
}
declare class WireTypeRegistry {
    private static wireTypes;
    static register(def: WireTypeDefinition): void;
    static get(wireType: string): WireTypeDefinition | undefined;
    static list(): WireTypeDefinition[];
    static clear(): void;
}

interface CompatibilityRule {
    sourceCategory: HandleCategory;
    sourceDataType: string;
    targetCategory: HandleCategory;
    targetDataType: string;
    allowed: boolean;
    wireType: string;
    priority: number;
}
interface CompatibilityResolution {
    allowed: boolean;
    wireType?: string;
    priority?: number;
    reason?: string;
}
declare class CompatibilityMatrix {
    private static rules;
    static registerRule(rule: CompatibilityRule): void;
    static clear(): void;
    static resolve(sourceHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>, targetHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>): CompatibilityResolution;
}

declare function initializeDefaultGraphRules(): void;

interface HandleDescriptor {
    dataType?: string;
    direction?: HandleDirection | 'input' | 'output';
    handleCategory?: HandleCategory;
}
/**
 * ConnectionRuleStore — Central authoritative store for:
 * 1. Handle types
 * 2. Wire types
 * 3. Node types & schemas
 * 4. Inter-handle compatibility and connection rules
 */
declare class ConnectionRuleStore {
    private static nodeTypes;
    private static listeners;
    private static initialized;
    static initializeDefaults(): void;
    static isInitialized(): boolean;
    static subscribe(listener: () => void): () => void;
    private static notify;
    static registerNodeType(def: NodeDefinition): void;
    static registerNodeTypes(defs: NodeDefinition[]): void;
    static getNodeType(type: string): NodeDefinition | undefined;
    static listNodeTypes(): NodeDefinition[];
    static hasNodeType(type: string): boolean;
    static registerHandleType(def: HandleTypeDefinition): void;
    static getHandleType(dataType: string): HandleTypeDefinition | undefined;
    static listHandleTypes(): HandleTypeDefinition[];
    static hasHandleType(dataType: string): boolean;
    static registerWireType(def: WireTypeDefinition): void;
    static getWireType(wireType: string): WireTypeDefinition | undefined;
    static listWireTypes(): WireTypeDefinition[];
    static registerRule(rule: CompatibilityRule): void;
    static resolve(sourceHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>, targetHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>): CompatibilityResolution;
    static canConnect(sourceHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>, targetHandle: Pick<BaseHandle, 'handleCategory' | 'dataType' | 'direction'>): boolean;
    /**
     * Returns all node definitions that have at least one socket compatible with the dragged handle.
     * If source handle is OUTPUT, checks candidate node INPUT sockets.
     * If source handle is INPUT, checks candidate node OUTPUT sockets.
     */
    static getCompatibleNodeTypes(sourceHandle: HandleDescriptor, candidateNodes?: NodeDefinition[]): NodeDefinition[];
    /**
     * Find compatible sockets on a given target node for a dragged source handle.
     */
    static findCompatibleSockets(sourceHandle: HandleDescriptor, targetNode: NodeDefinition): HandleDefinition[];
    static clear(): void;
}

declare class SpatialEngine {
    static calculateEffectiveHandlePosition(node: BaseNode, handle: BaseHandle): HandlePosition;
    static calculateDistance(p1: HandlePosition, p2: HandlePosition): number;
    static calculateOffsetMagnitude(handle: BaseHandle): number;
}

interface Trace {
    id: string;
    sourceNodeId: string;
    sourceHandleId: string;
    targetNodeId: string;
    targetHandleId: string;
    wireType: string;
    compatibility: CompatibilityResolution;
    spatialScore: number;
}
declare class TraceEngine {
    static computeTraces(nodes: BaseNode[], cutoffDistance: number): Trace[];
}

declare class AutoSolidify {
    static resolve(nodes: BaseNode[], traces: Trace[], existingConnections: SolidConnection[]): SolidConnection[];
}

declare class AttractionEngine {
    static computeSimilarity(nodeA: BaseNode, nodeB: BaseNode): number;
    static calculateStep(nodes: BaseNode[], strength?: number, speed?: number): Map<string, NodePosition>;
}

interface SocketCoordOptions {
    cardWidth: number;
    isOutput: boolean;
    clearance?: number;
    nudge?: {
        x: number;
        y: number;
    };
}
interface SocketCoordResult {
    baseX: number;
    effectiveX: number;
    effectiveY: number;
    nudge: {
        x: number;
        y: number;
    };
}
/**
 * Calculates socket handle coordinates enforcing the 12px spatial clearance invariant
 * and applying custom nudge displacement offsets.
 */
declare function calculateSocketCoordinates(baseY: number, options: SocketCoordOptions): SocketCoordResult;
/**
 * Dual-layered polygon beam points helper for tapered energy beam tethers.
 * Tapers from thick at base (node body) to a fine point at head (displaced handle).
 */
declare const getBeamPoints: (nudge: {
    x: number;
    y: number;
}, baseW?: number, headW?: number) => string;

interface GhostSocketMapping {
    sourceSocketId: string;
    targetSocketId: string;
    wireType: string;
}
interface GhostCandidate {
    id: string;
    nodeType: string;
    label: string;
    scenarioIndex: number;
    score: number;
    sourceNodeId: string;
    socketMappings: GhostSocketMapping[];
    relativeOffset: {
        x: number;
        y: number;
    };
}
interface GhostNodeRecord {
    id: string;
    nodeType: string;
    label: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
    scenarioIndex: number;
    sourceNodeId: string;
    socketMappings: GhostSocketMapping[];
    inputs?: Socket[];
    outputs?: Socket[];
}
interface GhostTraceRecord {
    id: string;
    sourceNodeId: string;
    sourceSocketId: string;
    targetGhostNodeId: string;
    targetSocketId: string;
    wireType: string;
    pathD: string;
    scenarioIndex: number;
}
interface GhostInferenceOptions {
    scenarioCount?: number;
    maxSuggestionsPerNode?: number;
    customScorer?: (sourceType: string, candidateType: string) => number;
}

declare class GhostInferenceEngine {
    static inferNextNodes(selectedNodes: GraphNode[], allNodeDefs: NodeDefinition[], options?: GhostInferenceOptions): GhostCandidate[];
    private static resolveSocketMappings;
    private static computeAffinityScore;
}

declare class GhostLayoutResolver {
    static resolveLayout(candidates: GhostCandidate[], existingNodes: GraphNode[], allNodeDefs: NodeDefinition[]): GhostNodeRecord[];
    private static findNonOverlappingPosition;
    private static intersects;
}

declare class GhostTracePathBuilder {
    static buildGhostTraces(ghostNodes: GhostNodeRecord[], existingNodes: GraphNode[]): GhostTraceRecord[];
    private static getRealSocketPosition;
    private static getGhostSocketPosition;
    static renderBezier(startX: number, startY: number, endX: number, endY: number): string;
}

interface MagneticTraceRecord {
    id: string;
    sourceNodeId: string;
    sourceSocketId: string;
    targetNodeId: string;
    targetSocketId: string;
    wireType: string;
    color: string;
    pathD: string;
    midpoint: {
        x: number;
        y: number;
    };
    distance: number;
}

interface UseMagneticTracesParams {
    nodes: GraphNode[];
    edges: GraphEdge[];
    config?: NodeGraphConfig;
    onEdgesChange?: (edges: GraphEdge[]) => void;
}
declare function useMagneticTraces({ nodes, edges, config, onEdgesChange }: UseMagneticTracesParams): {
    traces: MagneticTraceRecord[];
    isEnabled: boolean;
    solidifyTrace: (traceId: string) => void;
    solidifyAll: () => void;
};

declare class GroupSettingsResolver {
    static resolveEffectiveSetting<K extends keyof GraphSettings>(settingKey: K, rootSettings: GraphSettings, targetOverrides?: Partial<GraphSettings>, groupId?: string, groups?: Group[]): GraphSettings[K];
    static resolveAllSettings(rootSettings: GraphSettings, targetOverrides?: Partial<GraphSettings>, groupId?: string, groups?: Group[]): GraphSettings;
}

declare class LandmarkManager {
    private landmarks;
    constructor(initialLandmarks?: Landmark[]);
    createLandmark(number: number, name: string, cameraPosition: {
        x: number;
        y: number;
    }, zoom: number): Landmark;
    getByNumber(number: number): Landmark | undefined;
    getById(id: string): Landmark | undefined;
    updateLandmark(id: string, updates: Partial<Omit<Landmark, 'id'>>): Landmark | undefined;
    deleteLandmark(id: string): boolean;
    list(): Landmark[];
    clear(): void;
}

interface CaptureGraphSnapshotParams {
    id?: string;
    name: string;
    nodes: BaseNode[];
    viewWindows: BaseViewWindow[];
    camera: {
        x: number;
        y: number;
    };
    zoom: number;
    selectedNodeIds: string[];
    settingsOverrides?: Partial<GraphSettings>;
}
declare class ViewEngine {
    private views;
    constructor(initialViews?: GraphView[]);
    captureView(params: CaptureGraphSnapshotParams): GraphView;
    getView(id: string): GraphView | undefined;
    listViews(): GraphView[];
    deleteView(id: string): boolean;
}

interface CreateViewWindowParams {
    id?: string;
    viewType: string;
    sourceNodeId: string;
    sourceViewHandleId: string;
    position: NodePosition;
    size?: NodeSize;
}
declare class ViewWindowManager {
    private windows;
    private links;
    createWindow(params: CreateViewWindowParams): {
        window: BaseViewWindow;
        link: ViewLink;
    };
    selectWindow(id: string): void;
    pinLive(id: string, pinned: boolean): void;
    removeWindow(id: string): boolean;
    getProcessingWindows(): BaseViewWindow[];
    getWindow(id: string): BaseViewWindow | undefined;
    getLink(windowId: string): ViewLink | undefined;
    listWindows(): BaseViewWindow[];
    listLinks(): ViewLink[];
}

type GraphListener = () => void;
declare class GraphStore {
    nodes: BaseNode[];
    connections: SolidConnection[];
    traces: Trace[];
    groups: Group[];
    settings: GraphSettings;
    selectedNodeIds: Set<string>;
    readonly viewWindows: ViewWindowManager;
    readonly landmarks: LandmarkManager;
    readonly views: ViewEngine;
    private listeners;
    subscribe(listener: GraphListener): () => void;
    notify(): void;
    refreshTraces(): void;
    solidifyTrace(traceId: string): SolidConnection | undefined;
    lockAllConnections(): void;
}

declare class CommandApi {
    private store;
    constructor(store: GraphStore);
    get nodes(): {
        create: (props: BaseNodeProps) => BaseNode;
        delete: (nodeId: string) => void;
        move: (nodeId: string, x: number, y: number) => void;
        lockPosition: (nodeId: string) => void;
        unlockPosition: (nodeId: string) => void;
    };
    get handles(): {
        move: (nodeId: string, handleId: string, offset: HandleOffset) => void;
        resetOffset: (nodeId: string, handleId: string) => void;
    };
    get traces(): {
        refresh: () => void;
        enable: () => void;
        disable: () => void;
        solidify: (traceId: string) => SolidConnection | undefined;
    };
    get connections(): {
        create: (sourceNodeId: string, sourceHandleId: string, targetNodeId: string, targetHandleId: string, wireType?: string) => SolidConnection;
        delete: (connectionId: string) => void;
        lock: (connectionId: string) => void;
        unlock: (connectionId: string) => void;
        lockAll: () => void;
    };
    get groups(): {
        create: (group: Group) => void;
        delete: (groupId: string) => void;
    };
    get landmarks(): {
        create: (num: number, name: string, camera: {
            x: number;
            y: number;
        }, zoom: number) => Landmark;
        delete: (id: string) => boolean;
        list: () => Landmark[];
    };
    get viewWindows(): {
        create: (params: Parameters<typeof this$1.store.viewWindows.createWindow>[0]) => {
            window: BaseViewWindow;
            link: ViewLink;
        };
        close: (id: string) => boolean;
        select: (id: string) => void;
        pinLive: (id: string, pinned: boolean) => void;
    };
}

type GhostStoreListener = () => void;
declare class GhostStore {
    private static instance;
    isActive: boolean;
    ghostNodes: GhostNodeRecord[];
    ghostTraces: GhostTraceRecord[];
    scenarioIndex: number;
    hoveredGhostId: string | null;
    sourceNodeIds: string[];
    private listeners;
    static getInstance(): GhostStore;
    subscribe(listener: GhostStoreListener): () => void;
    notify(): void;
    setPredictions(nodes: GhostNodeRecord[], traces: GhostTraceRecord[], sourceNodeIds: string[]): void;
    cycleScenario(maxScenarios?: number): void;
    setHoveredGhostId(id: string | null): void;
    getActiveGhostNodes(): GhostNodeRecord[];
    getActiveGhostTraces(): GhostTraceRecord[];
    clear(): void;
}

interface MidpointWidgetsProps {
    x: number;
    y: number;
    locked: boolean;
    onDelete?: () => void;
    onInspect?: () => void;
    onToggleLock?: () => void;
}
declare function MidpointWidgets({ x, y, locked, onDelete, onInspect, onToggleLock }: MidpointWidgetsProps): react.JSX.Element;

interface SolidifyWidgetProps {
    x: number;
    y: number;
    onSolidify: () => void;
}
declare function SolidifyWidget({ x, y, onSolidify }: SolidifyWidgetProps): react.JSX.Element;

interface CompatibleNodePickerProps {
    x: number;
    y: number;
    sourceHandle: {
        nodeId: string;
        socketId: string;
        direction: 'input' | 'output';
        dataType?: string;
        label?: string;
    };
    availableNodeTypes?: NodeDefinition[];
    onSelect: (selectedTypes: string[]) => void;
    onClose: () => void;
}
declare function CompatibleNodePicker({ x, y, sourceHandle, availableNodeTypes, onSelect, onClose }: CompatibleNodePickerProps): react.JSX.Element;

interface NodeSearchPaletteProps {
    x: number;
    y: number;
    availableNodeTypes?: NodeDefinition[];
    onSpawnNode: (type: string) => void;
    onClose: () => void;
}
declare function NodeSearchPalette({ x, y, availableNodeTypes, onSpawnNode, onClose }: NodeSearchPaletteProps): react.JSX.Element;

interface CanvasContextMenuProps {
    x: number;
    y: number;
    availableNodeTypes?: NodeDefinition[];
    hasSelection: boolean;
    onSpawnNode: (type: string) => void;
    onOpenSpawnMenu?: () => void;
    onSelectAll: () => void;
    onDeleteSelected: () => void;
    onClearSelection: () => void;
    onClose: () => void;
}
declare function CanvasContextMenu({ x, y, availableNodeTypes, hasSelection, onSpawnNode, onOpenSpawnMenu, onSelectAll, onDeleteSelected, onClearSelection, onClose }: CanvasContextMenuProps): react__default.JSX.Element;

interface MagneticTraceLayerProps {
    traces: MagneticTraceRecord[];
    onSolidify: (traceId: string) => void;
}
declare function MagneticTraceLayer({ traces, onSolidify }: MagneticTraceLayerProps): react.JSX.Element | null;

interface GraphToolbarProps {
    settings: GraphSettings;
    onUpdateSettings: (updates: Partial<GraphSettings>) => void;
    onRefreshTraces: () => void;
    onLockAllConnections: () => void;
    onSaveView?: () => void;
    onLoadView?: () => void;
    className?: string;
}
declare function GraphToolbar({ settings, onUpdateSettings, onRefreshTraces, onLockAllConnections, onSaveView, onLoadView, className }: GraphToolbarProps): react__default.JSX.Element;

interface ReactFlowNodeData {
    nodeId: string;
    label: string;
    type: string;
    handles: {
        id: string;
        direction: 'INPUT' | 'OUTPUT';
        category: 'DATA' | 'VIEW';
        dataType: string;
        offset: {
            x: number;
            y: number;
        };
    }[];
    positionLocked: boolean;
    customData?: Record<string, unknown>;
}
interface ReactFlowEdgeData {
    connectionId: string;
    sourceNodeId: string;
    sourceHandleId: string;
    targetNodeId: string;
    targetHandleId: string;
    wireType: string;
    locked: boolean;
    isTrace?: boolean;
    isViewLink?: boolean;
}
declare class ReactFlowAdapter {
    static toReactFlowNodes(nodes: BaseNode[]): Array<{
        id: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: ReactFlowNodeData;
    }>;
    static toReactFlowEdges(connections: SolidConnection[], traces?: Trace[], viewLinks?: ViewLink[]): Array<{
        id: string;
        source: string;
        sourceHandle: string;
        target: string;
        targetHandle: string;
        type: string;
        animated?: boolean;
        data: ReactFlowEdgeData;
    }>;
    static toReactFlowViewWindows(windows: BaseViewWindow[]): Array<{
        id: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: {
            windowId: string;
            viewType: string;
            sourceNodeId: string;
            dynamicState: string;
            pinnedLive: boolean;
            size: {
                width: number;
                height: number;
            };
        };
    }>;
}

interface GhostTraceLayerProps {
    traces: GhostTraceRecord[];
    hoveredGhostId?: string | null;
}
declare function GhostTraceLayer({ traces, hoveredGhostId }: GhostTraceLayerProps): react.JSX.Element | null;

interface GhostNodeCardProps {
    ghostNode: GhostNodeRecord;
    isHovered?: boolean;
    onHover?: (id: string | null) => void;
    onSolidify?: (id: string) => void;
}
declare function GhostNodeCard({ ghostNode, isHovered, onHover, onSolidify }: GhostNodeCardProps): react.JSX.Element;

interface GhostSolidifyBarProps {
    ghostNodes: GhostNodeRecord[];
    scenarioIndex: number;
    maxScenarios?: number;
    onCycleScenario: () => void;
    onSolidifyAll: () => void;
    onDismiss: () => void;
}
declare function GhostSolidifyBar({ ghostNodes, scenarioIndex, maxScenarios, onCycleScenario, onSolidifyAll, onDismiss }: GhostSolidifyBarProps): react.JSX.Element | null;

interface Viewer2DNodesProps {
    node: GraphNode;
    selected?: boolean;
    onMouseDown?: (e: react__default.MouseEvent, nodeId: string) => void;
    onDoubleClick?: (nodeId: string) => void;
    onSocketMouseDown?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
    onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {
        x: number;
        y: number;
    }) => void;
}
declare function Viewer2DNodes({ node, selected, onMouseDown, onDoubleClick, onSocketMouseDown, onSocketNudgeChange }: Viewer2DNodesProps): react__default.JSX.Element;
interface MovableSocketHandleProps {
    socket: Socket;
    nodeId: string;
    cardWidth: number;
    isOutput: boolean;
    baseY: number;
    onSocketMouseDown?: (e: react__default.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
    onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {
        x: number;
        y: number;
    }) => void;
}
declare function MovableSocketHandle({ socket, nodeId, cardWidth, isOutput, baseY, onSocketMouseDown, onSocketNudgeChange }: MovableSocketHandleProps): react__default.JSX.Element;

interface UseGhostRoutingParams {
    nodes: GraphNode[];
    edges: GraphEdge[];
    selectedNodeIds: Set<string>;
    config?: NodeGraphConfig;
    availableNodeTypes?: NodeDefinition[];
    onNodesChange?: (nodes: GraphNode[]) => void;
    onEdgesChange?: (edges: GraphEdge[]) => void;
}
declare function useGhostRouting({ nodes, edges, selectedNodeIds, config, availableNodeTypes, onNodesChange, onEdgesChange }: UseGhostRoutingParams): {
    isActive: boolean;
    activeGhostNodes: GhostNodeRecord[];
    activeGhostTraces: GhostTraceRecord[];
    scenarioIndex: number;
    hoveredGhostId: string | null;
    setHoveredGhostId: (id: string | null) => void;
    solidifyOne: (ghostId: string) => void;
    solidifyAll: () => void;
    cycleScenario: () => void;
    dismiss: () => void;
};

export { AttractionEngine, AutoSolidify, BaseConnection, type BaseConnectionProps, BaseGraph, BaseHandle, type BaseHandleProps, BaseNode, type BaseNodeProps, BaseViewWindow, type BaseViewWindowProps, CanvasContextMenu, type CanvasContextMenuProps, type CaptureGraphSnapshotParams, CommandApi, CompatibilityMatrix, type CompatibilityResolution, type CompatibilityRule, CompatibleNodePicker, type CompatibleNodePickerProps, type ConnectionMode, ConnectionRuleStore, type CreateViewWindowParams, CustomGraph, CustomNode, CustomViewWindow, DEFAULT_GRAPH_SETTINGS, DataHandle, type DynamicState, type GhostCandidate, GhostInferenceEngine, type GhostInferenceOptions, GhostLayoutResolver, GhostNodeCard, type GhostNodeCardProps, type GhostNodeRecord, type GhostSocketMapping, GhostSolidifyBar, type GhostSolidifyBarProps, GhostStore, type GhostStoreListener, GhostTraceLayer, type GhostTraceLayerProps, GhostTracePathBuilder, type GhostTraceRecord, type GraphEdge, type GraphListener, type GraphNode, type GraphSettings, GraphStore, GraphToolbar, type GraphToolbarProps, type GraphView, type Group, GroupSettingsResolver, type HandleCategory, type HandleDefinition, type HandleDescriptor, type HandleDirection, type HandleOffset, type HandlePosition, type HandleTypeDefinition, HandleTypeRegistry, type Landmark, LandmarkManager, MagneticTraceLayer, type MagneticTraceLayerProps, type MagneticTraceRecord, MidpointWidgets, type MidpointWidgetsProps, MovableSocketHandle, MovableSocketView, type MovableSocketViewProps, NodeCard, type NodeCardProps, type NodeDefinition, NodeDetailsPanel, type NodeDetailsPanelProps, NodeEmblem, type NodeEmblemProps, NodeGraphCanvas, type NodeGraphCanvasProps, type NodeGraphConfig, type NodeGraphPlugin, type NodePosition, NodeSearchPalette, type NodeSearchPaletteProps, type NodeSize, PRIMITIVE_NODE_DEFINITIONS, ReactFlowAdapter, type ReactFlowEdgeData, type ReactFlowNodeData, type Socket, type SocketCoordOptions, type SocketCoordResult, type SocketType, SolidConnection, type SolidConnectionProps, SolidifyWidget, type SolidifyWidgetProps, SpatialEngine, type Trace, TraceEngine, type UseGhostRoutingParams, type UseMagneticTracesParams, ViewEngine, ViewHandle, ViewLink, type ViewLinkProps, ViewWindowManager, Viewer2DNodes, type Viewer2DNodesProps, type ViewportState, WireRenderer, type WireTypeDefinition, WireTypeRegistry, calculateSocketCoordinates, canvasToScreen, clampZoom, fitToView, getBeamPoints, getCenterPanForNode, getNodesInSelection, initializeDefaultGraphRules, isNodeInCenterDeadZone, screenToCanvas, useGhostRouting, useMagneticTraces, useNodeGraph, zoomAtPoint };

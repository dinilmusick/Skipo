/**
 * PRODUCTION DEBUG API INFRASTRUCTURE - CORE TYPE DEFINITIONS
 * Strict TypeScript models for headless production debugging, 4-tier state inspection,
 * consistency verification, event tracing, and diagnostics.
 */

export type DebugMode = 'OFF' | 'OBSERVE' | 'TRACE';

export interface DebugSession {
  id: string;
  mode: DebugMode;
  enabled: boolean;
  enabledAt: number;
  expiresAt: number;
  ttlMinutes: number;
  workspaceId?: string;
  userId?: string;
  actor?: string;
  capturePayloads?: boolean;
  maskDocumentText?: boolean;
}

export interface DebugConfiguration {
  maxEvents: number;
  ttlMinutes: number;
  capturePayloads: boolean;
  maskDocumentText: boolean;
  persistEventsToDisk: boolean;
  enabledLayers: string[];
  retentionHours: number;
}

export interface DebugEndpointDescriptor {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  modeRequired: DebugMode;
}

export interface DebugManifest {
  debugEnabled: boolean;
  activeMode: DebugMode;
  activeSession: DebugSession | null;
  activeWorkspaceId: string | null;
  availableEndpoints: DebugEndpointDescriptor[];
  supportedOperations: string[];
  systemMetrics: {
    memoryUsageMb: number;
    uptimeSec: number;
    eventsBuffered: number;
    mutationsCount: number;
    requestsCount: number;
    errorsCount: number;
  };
}

export interface FrontendSnapshot {
  workspaceId: string;
  clientConnected: boolean;
  lastSeenAgoMs: number;
  graph: {
    nodes: any[];
    edges: any[];
    groups: any[];
  };
  categories: any[];
  documents: any[];
  uiState: Record<string, any>;
  revision: number;
  timestamp: number;
}

export interface BackendSnapshot {
  workspaceId: string;
  graph: {
    nodes: any[];
    edges: any[];
    groups: any[];
  };
  categories: any[];
  documents: any[];
  revision: number;
  timestamp: number;
}

export interface PersistedSnapshot {
  workspaceId: string;
  storageProvider: string;
  vaultPath: string;
  filePath: string;
  graph: {
    nodes: any[];
    edges: any[];
    groups: any[];
  };
  categories: any[];
  documents: any[];
  rawPayloadSize: number;
  revision: number;
  timestamp: number;
  existsOnDisk: boolean;
}

export interface RenderedSnapshot {
  workspaceId: string;
  renderedNodeIds: string[];
  renderedEdgeIds: string[];
  renderedGroupIds: string[];
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  visibleNodeIds: string[];
  selectedNodeIds: string[];
  viewport: {
    scale: number;
    pan: { x: number; y: number };
  };
  zoomLevel: number;
  renderOmissions?: string[];
  timestamp: number;
}

export type DiscrepancyType =
  | 'PHANTOM_NODE'
  | 'GHOST_NODE'
  | 'ZOMBIE_EDGE'
  | 'REVISION_LAG'
  | 'RENDER_LAG'
  | 'PROPERTY_DRIFT'
  | 'COUNT_MISMATCH'
  | 'ENTITY_MISSING';

export interface Discrepancy {
  type: DiscrepancyType;
  entity: 'node' | 'edge' | 'group' | 'document' | 'category' | 'revision';
  id: string;
  details: string;
  sourceLayer?: string;
  targetLayer?: string;
  divergenceTime?: number;
}

export interface LayerComparison {
  layerA: string;
  layerB: string;
  match: boolean;
  nodeDiff: number;
  edgeDiff: number;
  docDiff: number;
  catDiff: number;
}

export interface WorkspaceRevisions {
  workspaceId: string;
  frontendRevision: number;
  backendRevision: number;
  persistedRevision: number;
  inSync: boolean;
  driftType: 'IN_SYNC' | 'AHEAD' | 'BEHIND' | 'COLLISION';
}

export interface ConsistencyCheckResult {
  workspaceId: string;
  timestamp: number;
  consistent: boolean;
  layerComparisons: LayerComparison[];
  discrepancies: Discrepancy[];
  revisions: WorkspaceRevisions;
  summary: {
    persistedNodeCount: number;
    backendNodeCount: number;
    frontendNodeCount: number;
    renderedNodeCount: number;
  };
}

export interface StateDiffItem {
  entity: 'node' | 'edge' | 'group' | 'document' | 'category';
  id: string;
  field?: string;
  source?: any;
  target?: any;
  data?: any;
}

export interface StateDiff {
  workspaceId: string;
  source: string;
  target: string;
  equal: boolean;
  added: StateDiffItem[];
  removed: StateDiffItem[];
  changed: StateDiffItem[];
  timestamp: number;
}

export type MutationType =
  | 'NODE_CREATE'
  | 'NODE_MOVE'
  | 'NODE_UPDATE'
  | 'NODE_DELETE'
  | 'EDGE_CREATE'
  | 'EDGE_DELETE'
  | 'GROUP_CREATE'
  | 'GROUP_UPDATE'
  | 'DOCUMENT_ATTACH'
  | 'DOCUMENT_DETACH'
  | 'WORKSPACE_UPDATE';

export interface MutationEvent {
  id: string;
  timestamp: number;
  workspaceId: string;
  type: MutationType;
  payload: any;
  source: 'frontend_user' | 'backend_sync' | 'storage_reload' | 'api_mutation';
  resultingRevision: number;
}

export interface ApiDebugEvent {
  id: string;
  timestamp: number;
  workspaceId?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestBody?: any;
  responseBody?: any;
  initiator?: string;
}

export interface PersistenceDebugEvent {
  id: string;
  timestamp: number;
  workspaceId: string;
  type: 'READ' | 'WRITE' | 'DELETE';
  storageProvider: string;
  filePath: string;
  durationMs: number;
  payloadSizeBytes: number;
  success: boolean;
  error?: string;
}

export interface ErrorDebugEvent {
  id: string;
  timestamp: number;
  workspaceId?: string;
  layer: 'frontend' | 'backend' | 'persistence' | 'renderer';
  message: string;
  stack?: string;
  operation?: string;
  breadcrumbs?: string[];
}

export interface PerformanceSample {
  id: string;
  timestamp: number;
  workspaceId?: string;
  metric:
    | 'state_sync_latency'
    | 'persistence_write_latency'
    | 'graph_render_duration'
    | 'api_response_time'
    | 'payload_size';
  value: number;
  unit: 'ms' | 'bytes';
  context?: Record<string, any>;
}

export interface DebugEvent {
  id: string;
  timestamp: number;
  type: string;
  workspaceId?: string;
  data: any;
}

export interface CompleteWorkspaceSnapshot {
  workspaceId: string;
  timestamp: number;
  frontend: FrontendSnapshot | null;
  backend: BackendSnapshot;
  persisted: PersistedSnapshot;
  rendered: RenderedSnapshot | null;
  revisions: WorkspaceRevisions;
  consistency: ConsistencyCheckResult;
}

export interface DiagnosticBundle {
  exportVersion: string;
  exportedAt: number;
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  };
  debugStatus: DebugManifest;
  config: DebugConfiguration;
  activeWorkspaces: CompleteWorkspaceSnapshot[];
  consistencyChecks: Record<string, ConsistencyCheckResult>;
  recentMutations: MutationEvent[];
  recentRequests: ApiDebugEvent[];
  recentPersistenceEvents: PersistenceDebugEvent[];
  recentErrors: ErrorDebugEvent[];
  performanceMetrics: {
    recentSamples: PerformanceSample[];
    averages: Record<string, number>;
  };
}

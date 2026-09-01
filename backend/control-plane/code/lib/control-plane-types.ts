// ══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL PLANE & WORKSPACE DATA PLANE TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════════════════

export type AdminBackendEngine = 'sqlite' | 'postgres' | 'supabase' | 'neon' | 'firebase' | 'turso' | 'remote_auth' | 'local_fs';

export type DatabaseRole = 'primary' | 'redundant_clone' | 'failover_standby';
export type DatabaseTargetScope = 'accounts' | 'workspaces' | 'all';

export type DataEngineType =
  | 'sqlite'
  | 'postgres'
  | 'supabase'
  | 'neon'
  | 'turso'
  | 'mongodb'
  | 'pocketbase'
  | 'firebase'
  | 'custom_api';

export type StorageEngineType =
  | 'filesystem'
  | 'local'
  | 'local_fs'
  | 'browser_local_fs'
  | 'icloud_drive'
  | 'google_drive'
  | 'onedrive'
  | 'supabase_storage'
  | 'firebase_storage'
  | 's3'
  | 'vercel_blob'
  | 'pocketbase_storage';

export type ConflictResolutionStrategy = 'primary_wins' | 'backup_wins' | 'newest_wins';

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'error';
  lastSyncTimestamp: number;
  pendingOperations: number;
  divergenceCount: number;
}

export interface DatabaseConnectionEntry {
  id: string;
  name: string;
  engine: AdminBackendEngine | DataEngineType;
  role: DatabaseRole;
  target: DatabaseTargetScope;
  enabled: boolean;
  endpoint?: string;
  authToken?: string;
  sqlite?: {
    dbPath: string;
    walMode: boolean;
  };
  postgres?: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl: boolean;
  };
  supabase?: {
    url: string;
    serviceRoleKey?: string;
    anonKey?: string;
    connectionString?: string;
    tableName?: string;
    poolerMode?: 'transaction' | 'session' | 'direct';
  };
  neon?: {
    connectionString: string;
    tableName?: string;
    pooled?: boolean;
  };
  firebase?: {
    apiKey: string;
    authDomain?: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    collectionName?: string;
  };
  turso?: {
    endpoint: string;
    authToken: string;
  };
  remote_auth?: {
    endpointUrl: string;
    apiKey?: string;
  };
  status: 'connected' | 'error' | 'testing' | 'offline';
  source?: 'env' | 'runtime';
  isFromEnv?: boolean;
  envVarKey?: string;
  lastTestedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  latencyMs?: number;
  recordsCloned?: number;
  createdAt: string;
}

export interface AdminDatabaseClusterConfig {
  activeProfile: string;
  databases: DatabaseConnectionEntry[];
  autoSyncRedundancy: boolean;
  syncIntervalMinutes: number;
  lastClusterSyncAt?: string;
  totalRedundancyClones: number;
}

export interface AdminBackendConfig {
  engine: AdminBackendEngine;
  activeProfile: string;
  sqlite: {
    dbPath: string;
    walMode: boolean;
  };
  postgres: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl: boolean;
  };
  supabase: {
    url: string;
    serviceRoleKey?: string;
    anonKey?: string;
    connectionString?: string;
    tableName?: string;
    poolerMode?: 'transaction' | 'session' | 'direct';
  };
  neon?: {
    connectionString: string;
    tableName?: string;
    pooled?: boolean;
  };
  firebase?: {
    apiKey: string;
    authDomain?: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    collectionName?: string;
  };
  remote_auth: {
    endpointUrl: string;
    apiKey?: string;
  };
  status: 'connected' | 'error' | 'testing' | 'offline';
  lastTestedAt?: string;
  lastError?: string;
  latencyMs?: number;
}

export type DataProviderType = DataEngineType;
export type StorageProviderType = StorageEngineType;
export type ExecutionMode = 'Local' | 'LocalHosted' | 'CloudBaaS' | 'remote';

export interface WorkspaceDataPlaneConfig {
  workspaceId?: string;
  dataProvider?: DataProviderType;
  storageProvider?: StorageProviderType;
  mode?: ExecutionMode;
  primaryStorage?: any;
  backupStorage?: any[];
  conflictResolution?: ConflictResolutionStrategy;
  enableSyncLogs?: boolean;
  credentials?: Record<string, string>;
  database?: {
    type: DataEngineType;
    endpoint?: string;
    authToken?: string;
    dbPath?: string;
  };
  storage?: {
    type: StorageEngineType;
    token?: string;
    basePath?: string;
    bucket?: string;
  };
  options?: {
    walEnabled?: boolean;
    strictSsl?: boolean;
    postgrestUrl?: string;
    collectionPrefix?: string;
    relativeStoragePrefix?: string;
  };
  [key: string]: any;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// WORKSPACE STORAGE ARCHITECTURE & REPLICATION SPECS
// ══════════════════════════════════════════════════════════════════════════════════════════

export type StorageEndpointStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
export type StorageSyncState = 'SYNCED' | 'PENDING' | 'ERROR';

export interface StorageEndpointConfig {
  provider: StorageEngineType;
  basePath?: string;
  accountId?: string;
  rootFolderId?: string;
  projectUrl?: string;
  bucket?: string;
  token?: string;
  [key: string]: any;
}

export interface StorageEndpoint {
  id: string;
  provider: StorageEngineType;
  configuration: StorageEndpointConfig;
  enabled: boolean;
  status: StorageEndpointStatus;
  syncState?: StorageSyncState;
  lastSyncedAt?: number;
}

export interface SyncConfig {
  enabled: boolean;
  mode: 'on_write' | 'periodic' | 'manual';
  conflictStrategy: 'primary_wins' | 'backup_wins' | 'newest_wins';
  deletePropagation: boolean;
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };
  verification: {
    verifyChecksums: boolean;
  };
}

export interface Workspace {
  id: string;
  name: string;
  primaryStorage: StorageEndpoint;
  backupStorages: StorageEndpoint[];
  sync: SyncConfig;
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceRegistryItem {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  name: string;
  backendConfig: WorkspaceDataPlaneConfig;
  spec?: Workspace;
  createdAt: string;
  lastActiveAt?: string;
  docCount?: number;
  mediaCount?: number;
}

export interface FunctionalityRegistryEntry {
  id: string;
  name: string;
  tableName: string;
  service: string;
  recordCount: number;
  lastMutatedAt: string;
  autoMigrationStatus: 'synchronized' | 'pending' | 'migrated';
}

export interface ControlPlaneTelemetry {
  tokenFormat: string;
  adminGuardEnforced: boolean;
  totalUsers: number;
  totalAdmins: number;
  totalWorkspaces: number;
  isolationAssertPass: boolean;
  activeAdminBackend: string;
}

export interface ConnectionLatencyTestResult {
  ok: boolean;
  latencyMs: number;
  message?: string;
}


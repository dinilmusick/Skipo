import { BaseAccountProvider } from './auth/index.js';
export { AdminGuard, AuthCredentials, AuthSession, CreateUserData, LocalAccountProvider, PasswordHasher, RateLimiter, SessionManager, SignupInput, User, UserRole } from './auth/index.js';
import { BaseStorageAdapter, FileInfo } from './storage/index.js';
export { LocalFSAdapter, S3Adapter, StorageAdapterFactory, StorageConfig, StorageMode, StorageProviderType, SupabaseStorageAdapter, UploadResult } from './storage/index.js';
import { SkipoBase } from '@skipo/core';
export { ApiError, ApiResponse, BaseApiRoute, Middleware, RouteConfig, createSSEResponse, withAuth, withCors } from './api/index.js';

interface WorkspaceDescriptor {
    id: string;
    name: string;
    ownerId: string;
    createdAt: number;
    updatedAt: number;
}
type SyncState = 'SYNCED' | 'SYNCING' | 'ERROR' | 'OFFLINE';
type ConflictPolicy = 'primary_wins' | 'backup_wins' | 'newest_wins';
interface WorkspaceConfig {
    id: string;
    sync: {
        enabled: boolean;
        mode: 'on_write' | 'manual';
        conflictStrategy: ConflictPolicy;
        deletePropagation: boolean;
    };
}

declare function formatCanonicalWorkspaceFolderName(appName: string, userName: string, workspaceName: string): string;
declare function sanitizeWorkspaceName(name: string): string;

declare class SyncEngine extends SkipoBase {
    private primary;
    private backups;
    readonly config: WorkspaceConfig;
    constructor(primary: BaseStorageAdapter, backups: BaseStorageAdapter[], config: WorkspaceConfig);
    syncFile(pathStr: string): Promise<void>;
    deleteFile(pathStr: string): Promise<void>;
}

declare class WorkspaceFS extends SkipoBase {
    private primary;
    private syncEngine?;
    private config;
    constructor(primary: BaseStorageAdapter, config: WorkspaceConfig, syncEngine?: SyncEngine);
    setPrimary(newPrimary: BaseStorageAdapter): void;
    setSyncEngine(engine: SyncEngine): void;
    exists(pathStr: string): Promise<boolean>;
    stat(pathStr: string): Promise<FileInfo>;
    list(pathStr?: string): Promise<FileInfo[]>;
    read(pathStr: string): Promise<Uint8Array>;
    readText(pathStr: string): Promise<string>;
    write(pathStr: string, data: Uint8Array | Buffer | string): Promise<void>;
    mkdir(pathStr: string): Promise<void>;
    delete(pathStr: string): Promise<void>;
}

interface ClusterConfig {
    nodes: string[];
    primary: string;
}
interface AuditEvent {
    id: string;
    timestamp: number;
    userId: string;
    action: string;
    resource: string;
    details?: Record<string, any>;
}
interface HealthStatus {
    status: 'healthy' | 'degraded' | 'down';
    latencyMs: number;
    lastCheck: number;
}

declare class AuditLogger extends SkipoBase {
    private logFile;
    constructor(logFile?: string);
    log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
    query(filter: (e: AuditEvent) => boolean): Promise<AuditEvent[]>;
    tail(n: number): Promise<AuditEvent[]>;
}

declare class DatabaseClusterManager extends SkipoBase {
    private config;
    private health;
    constructor(config: ClusterConfig);
    probe(node: string): Promise<HealthStatus>;
    failover(): Promise<void>;
}

declare class ControlPlaneManager extends SkipoBase {
    auth: BaseAccountProvider;
    audit: AuditLogger;
    cluster: DatabaseClusterManager;
    constructor(auth: BaseAccountProvider, audit: AuditLogger, cluster: DatabaseClusterManager);
}

interface QueryFilter {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in';
    value: any;
}
interface SortOrder {
    field: string;
    direction: 'asc' | 'desc';
}
interface IDataProvider<T> {
    query(filters?: QueryFilter[], sort?: SortOrder[], limit?: number): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    insert(item: T): Promise<T>;
    update(id: string, item: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
    upsert(item: T): Promise<T>;
    count(filters?: QueryFilter[]): Promise<number>;
}

declare abstract class BaseDataProvider<T> extends SkipoBase implements IDataProvider<T> {
    abstract query(filters?: QueryFilter[], sort?: SortOrder[], limit?: number): Promise<T[]>;
    abstract getById(id: string): Promise<T | null>;
    abstract insert(item: T): Promise<T>;
    abstract update(id: string, item: Partial<T>): Promise<T>;
    abstract delete(id: string): Promise<boolean>;
    abstract upsert(item: T): Promise<T>;
    abstract count(filters?: QueryFilter[]): Promise<number>;
}

declare class FunctionalityTable<T extends {
    id: string;
}> extends BaseDataProvider<T> {
    private data;
    query(filters?: QueryFilter[], _sort?: SortOrder[], limit?: number): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    insert(item: T): Promise<T>;
    update(id: string, item: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
    upsert(item: T): Promise<T>;
    count(filters?: QueryFilter[]): Promise<number>;
}

export { type AuditEvent, AuditLogger, BaseAccountProvider, BaseDataProvider, BaseStorageAdapter, type ClusterConfig, type ConflictPolicy, ControlPlaneManager, DatabaseClusterManager, FileInfo, FunctionalityTable, type HealthStatus, type IDataProvider, type QueryFilter, type SortOrder, SyncEngine, type SyncState, type WorkspaceConfig, type WorkspaceDescriptor, WorkspaceFS, formatCanonicalWorkspaceFolderName, sanitizeWorkspaceName };

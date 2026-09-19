import { BaseAccountProvider } from './auth/index.js';
export { AdminGuard, AuthCredentials, AuthSession, CreateUserData, LocalAccountProvider, PasswordHasher, RateLimiter, SessionManager, SignupInput, User, UserRole } from './auth/index.js';
import { BaseStorageAdapter, FileInfo } from './storage/index.js';
export { BackblazeB2Adapter, ConnectionTestResult, DeleteFolderResult, LocalFSAdapter, RenameFolderResult, S3Adapter, StorageAdapterFactory, StorageConfig, StorageMode, StorageProviderType, SupabaseStorageAdapter, UploadResult, ensureS3DirectoryMarker, isSecretMasked, normalizeBackblazeCredentials, permanentDeleteS3Folder, permanentDeleteS3Object, renameS3Folder, resolveBackblazeEndpoint } from './storage/index.js';
import { SkipoBase } from '@skipo/core';
export { ApiError, ApiResponse, BaseApiRoute, Middleware, RouteConfig, createSSEResponse, withAuth, withCors } from './api/index.js';
export { A as AuthContext, B as BackendExecutor, a as BackendInstance, C as CallbackHandle, b as CapabilityContext, D as Delegation, c as DistributedLock, I as IdempotentRequest, J as Job, d as JobPriority, e as JobState, M as Message, f as MessageType, R as ResolutionStrategy, g as ResourceVersion, h as RoutingStrategy } from './types-BERZJ93O.js';
export { BackendContract, BackendRegistry, CallbackDefinition, ConcurrencyConflictError, ConcurrencyManager, DomainContract, EventDefinition, HealthMonitor, InProcessExecutor, JobDefinition, JobHandler, JobScheduler, LoadBalancer, LockManager, OperationDefinition, RemoteExecutor, RemoteExecutorOptions, createEmptyContract } from './connectivity/index.js';
export { B as BackendClient, a as BackendClientOptions, b as BackendResolver, c as BackendResolverOptions, C as CallbackFn, d as CallbackRegistry, D as DomainProxy, E as ErrorHandler, e as EventBus, f as EventHandler, F as FrontendSession, g as FrontendSessionOptions, G as GapHandler, H as HTTPTransport, h as HTTPTransportOptions, I as ITransport, M as MessageHandler, S as SequenceCheckResult, i as SequenceTracker, W as WebSocketTransport, j as WebSocketTransportOptions, k as createBackendClient } from './WebSocketTransport-CxUzUfwl.js';
export { I as IdempotencyManager } from './IdempotencyManager-B5MjK871.js';
export { BackendClientInstance, BackendProvider, BackendProviderProps, useBackend, useBackendClient } from './client/index.js';
export { AdaptedStorageConnection, AppServiceDeclaration, SrklClient, SrklClientOptions, SrklEcosystemQueryOptions, SrklEcosystemResponse, SrklServiceAccount, UseSrklServicesOptions, UseSrklServicesResult, createSrklClient, useSrklServices } from './srkl/index.js';
export { BackendCommand, DomainService, ExecutableBackendFacade, ExecutionContext, JobDependencyGraph, NormalizedResult, OperationComponent, ResultFlowBridge, ServiceDispatcher, StateUpdateEvent, WorkerExecutionBoundary, createOperationComponent } from './execution/index.js';
import 'react';

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

/**
 * @file types.ts
 * @description Formal TypeScript types and contracts for APP_ARCHITECTURE_SPEC.
 * Conforms strictly to Inviolable Law L7 and < 200 lines limit.
 */
type Runtime = 'client' | 'server';
type Deployment = 'local' | 'remote';
type FunctionSet = Record<string, (...args: any[]) => any>;
interface ServiceDefinition<T extends FunctionSet = FunctionSet> {
    name: string;
    version?: string;
    runtime: Runtime;
    deployment: Deployment;
    facade: T;
    metadata?: Record<string, unknown>;
}
interface ServiceFacade<T extends FunctionSet = FunctionSet> {
    runtime: Runtime;
    deployment: Deployment;
    service: T;
}
type OrchestrationFn = (...args: any[]) => Promise<any> | any;
interface BackendFacade<TServices extends Record<string, any> = Record<string, any>, TOrchestrations extends Record<string, OrchestrationFn> = Record<string, OrchestrationFn>> {
    services: TServices;
    orchestrations: TOrchestrations;
}
/**
 * Validates that a ServiceDefinition satisfies the mathematical invariants:
 * 1. deployment == "remote" => runtime == "server"
 * 2. runtime == "client" => deployment == "local"
 */
declare function validateServiceDefinition(def: {
    name?: string;
    runtime: Runtime;
    deployment: Deployment;
}): {
    valid: boolean;
    error?: string;
};
/**
 * Registry interface for service records in Gateway
 */
interface ServiceRegistryRecord {
    id: string;
    name: string;
    version: string;
    runtime: Runtime;
    deployment: Deployment;
    endpoint?: string;
    protocol?: 'http' | 'ws' | 'in-process';
    health?: 'healthy' | 'degraded' | 'unhealthy';
    metadata?: Record<string, unknown>;
}

export { type AuditEvent, AuditLogger, type BackendFacade, BaseAccountProvider, BaseDataProvider, BaseStorageAdapter, type ClusterConfig, type ConflictPolicy, ControlPlaneManager, DatabaseClusterManager, type Deployment, FileInfo, type FunctionSet, FunctionalityTable, type HealthStatus, type IDataProvider, type OrchestrationFn, type QueryFilter, type Runtime, type ServiceDefinition, type ServiceFacade, type ServiceRegistryRecord, type SortOrder, SyncEngine, type SyncState, type WorkspaceConfig, type WorkspaceDescriptor, WorkspaceFS, formatCanonicalWorkspaceFolderName, sanitizeWorkspaceName, validateServiceDefinition };

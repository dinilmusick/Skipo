import { t as ResourceVersion, J as Job, c as BackendInstance, u as RoutingStrategy, b as BackendExecutor, k as EventBus, g as CallbackRegistry, M as Message, C as CallbackFn, f as CallbackHandle, D as Delegation, I as ITransport } from '../WebSocketTransport-CHmkJ0tj.js';
export { A as AuthContext, B as BackendClient, a as BackendClientOptions, d as BackendResolver, e as BackendResolverOptions, h as CapabilityContext, i as DistributedLock, j as DomainProxy, E as ErrorHandler, l as EventHandler, F as FrontendSession, m as FrontendSessionOptions, G as GapHandler, H as HTTPTransport, n as HTTPTransportOptions, o as IdempotentRequest, p as JobPriority, q as JobState, r as MessageHandler, s as MessageType, R as ResolutionStrategy, S as SequenceCheckResult, v as SequenceTracker, W as WebSocketTransport, w as WebSocketTransportOptions, x as createBackendClient } from '../WebSocketTransport-CHmkJ0tj.js';

/**
 * @file BackendContract.ts
 * @description Canonical public surface contracts and capability schema definitions.
 */
interface OperationDefinition<TInput = unknown, TOutput = unknown> {
    name: string;
    domain: string;
    description?: string;
    handler?: (input: TInput, context?: unknown) => Promise<TOutput> | TOutput;
}
interface EventDefinition<TPayload = unknown> {
    name: string;
    domain: string;
    description?: string;
    payloadType?: TPayload;
}
interface CallbackDefinition<TArgs = unknown[], TReturn = unknown> {
    name: string;
    domain: string;
    description?: string;
    handler?: (...args: TArgs[]) => Promise<TReturn> | TReturn;
}
interface JobDefinition<TPayload = unknown, TResult = unknown> {
    type: string;
    domain: string;
    description?: string;
    handler?: (payload: TPayload, jobContext?: unknown) => Promise<TResult> | TResult;
}
interface DomainContract {
    domain: string;
    commands: Record<string, OperationDefinition>;
    queries: Record<string, OperationDefinition>;
    events: Record<string, EventDefinition>;
    callbacks: Record<string, CallbackDefinition>;
    jobs: Record<string, JobDefinition>;
}
interface BackendContract {
    version: string;
    domains: Record<string, DomainContract>;
    capabilities: string[];
}
declare function createEmptyContract(version?: string): BackendContract;

/**
 * @file BackendRegistry.ts
 * @description Central capability registry aggregating commands, queries, events, callbacks, and jobs.
 */

declare class BackendRegistry {
    private contract;
    constructor(version?: string);
    private ensureDomain;
    registerCapability(capabilityName: string): this;
    registerCommand<TInput = unknown, TOutput = unknown>(domain: string, name: string, handler: (input: TInput, context?: unknown) => Promise<TOutput> | TOutput, description?: string): this;
    registerQuery<TInput = unknown, TOutput = unknown>(domain: string, name: string, handler: (input: TInput, context?: unknown) => Promise<TOutput> | TOutput, description?: string): this;
    registerEvent(domain: string, name: string, description?: string): this;
    registerCallback(domain: string, name: string, handler?: (...args: any[]) => any, description?: string): this;
    registerJob<TPayload = unknown, TResult = unknown>(domain: string, type: string, handler: (payload: TPayload, context?: unknown) => Promise<TResult> | TResult, description?: string): this;
    getCommand(domain: string, name: string): OperationDefinition | undefined;
    getQuery(domain: string, name: string): OperationDefinition | undefined;
    getJob(domain: string, type: string): JobDefinition | undefined;
    exposeContract(): BackendContract;
}

/**
 * @file ConcurrencyManager.ts
 * @description Optimistic concurrency control and compare-and-swap (CAS) versioning primitive.
 */

declare class ConcurrencyConflictError extends Error {
    readonly resourceId: string;
    readonly expectedVersion: number;
    readonly actualVersion: number;
    constructor(resourceId: string, expectedVersion: number, actualVersion: number);
}
declare class ConcurrencyManager {
    private versions;
    private stateStore;
    getVersion(resourceId: string): number;
    setVersion(resourceId: string, version: number): ResourceVersion;
    compareAndSwap<T = unknown>(resourceId: string, expectedVersion: number, newValue: T): {
        success: boolean;
        newVersion: number;
        previousValue?: unknown;
    };
    optimisticUpdate<T = unknown>(resourceId: string, expectedVersion: number, mutation: () => Promise<T> | T): Promise<{
        result: T;
        newVersion: number;
    }>;
    getState<T = unknown>(resourceId: string): T | undefined;
    clear(): void;
}

/**
 * @file LockManager.ts
 * @description Resource-scoped FIFO Mutex and Distributed Lock Coordinator with timeout bounds and release guarantees.
 */
declare class LockManager {
    private locks;
    private defaultTimeoutMs;
    constructor(defaultTimeoutMs?: number);
    private getState;
    acquire(key: string, ownerId?: string, timeoutMs?: number): Promise<() => void>;
    private createRelease;
    release(key: string, leaseId?: string): void;
    withLock<T>(key: string, operation: () => Promise<T> | T, timeoutMs?: number): Promise<T>;
    isLocked(key: string): boolean;
    clear(): void;
}

/**
 * @file IdempotencyManager.ts
 * @description In-flight mutation deduplication, concurrent attachment, and completed result caching.
 */
declare class IdempotencyManager {
    private inFlight;
    private completedCache;
    private ttlMs;
    constructor(ttlMs?: number);
    executeIdempotent<T>(idempotencyKey: string, operation: () => Promise<T>): Promise<T>;
    has(idempotencyKey: string): boolean;
    prune(): void;
    clear(): void;
}

/**
 * @file JobScheduler.ts
 * @description DAG-based job sequencing engine supporting dependency ordering, priority queues, and concurrency control.
 */

type JobHandler<TPayload = any, TResult = any> = (job: Job<TPayload, TResult>, updateProgress: (progress: number) => void) => Promise<TResult>;
declare class JobScheduler {
    private jobs;
    private handlers;
    private sequenceCounters;
    private activeCount;
    private maxConcurrency;
    private paused;
    constructor(maxConcurrency?: number);
    registerHandler<TPayload = any, TResult = any>(type: string, handler: JobHandler<TPayload, TResult>): this;
    submit<TPayload = any, TResult = any>(input: Partial<Job<TPayload, TResult>> & {
        type: string;
        payload: TPayload;
    }): Job<TPayload, TResult>;
    private checkAndQueue;
    private priorityWeight;
    private drainQueue;
    private executeJob;
    cancel(jobId: string): boolean;
    pause(): void;
    resume(): void;
    status(jobId: string): Job | undefined;
    getAllJobs(): Job[];
    clear(): void;
}

/**
 * @file HealthMonitor.ts
 * @description Cluster health monitoring, heartbeat tracking, latency measurement, and automatic failure detection.
 */

declare class HealthMonitor {
    private instances;
    private staleThresholdMs;
    constructor(staleThresholdMs?: number);
    registerInstance(instance: Omit<BackendInstance, 'lastHeartbeat'>): BackendInstance;
    recordHeartbeat(instanceId: string, metrics?: Partial<BackendInstance>): void;
    markUnhealthy(instanceId: string, reason?: string): void;
    markHealthy(instanceId: string): void;
    getHealthyInstances(): BackendInstance[];
    getInstance(id: string): BackendInstance | undefined;
    removeInstance(id: string): boolean;
    clear(): void;
}

/**
 * @file LoadBalancer.ts
 * @description Cluster load balancer with pluggable routing strategies and automatic instance failover.
 */

declare class LoadBalancer {
    private healthMonitor;
    private defaultStrategy;
    private roundRobinIndex;
    constructor(healthMonitor?: HealthMonitor, defaultStrategy?: RoutingStrategy);
    getHealthMonitor(): HealthMonitor;
    selectInstance(strategy?: RoutingStrategy): BackendInstance;
    executeWithFailover<T>(operation: (instance: BackendInstance) => Promise<T>, maxRetries?: number): Promise<T>;
}

/**
 * @file InProcessExecutor.ts
 * @description In-memory direct execution adapter operating without network sockets or serialization overhead.
 */

declare class InProcessExecutor implements BackendExecutor {
    private registry;
    private eventBus;
    private callbackRegistry;
    private jobScheduler;
    constructor(registry?: BackendRegistry, eventBus?: EventBus, callbackRegistry?: CallbackRegistry, jobScheduler?: JobScheduler);
    getRegistry(): BackendRegistry;
    getEventBus(): EventBus;
    getCallbackRegistry(): CallbackRegistry;
    getJobScheduler(): JobScheduler;
    execute<T = unknown, R = unknown>(command: Message<T>): Promise<R>;
    query<T = unknown, R = unknown>(query: Message<T>): Promise<R>;
    subscribe(channel: string, handler: (event: Message) => void): () => void;
    emit(event: Message): Promise<void>;
    registerCallback(callback: CallbackFn): CallbackHandle;
    delegate<T = unknown, R = unknown>(delegation: Delegation<T>): Promise<R>;
    submitJob<T = unknown, R = unknown>(job: Partial<Job<T, R>>): Promise<Job<T, R>>;
}

/**
 * @file RemoteExecutor.ts
 * @description Transport-mediated executor encapsulating connection lifecycle, correlation IDs, and callback routing.
 */

interface RemoteExecutorOptions {
    transport: ITransport;
    loadBalancer?: LoadBalancer;
    callbackRegistry?: CallbackRegistry;
    sessionId?: string;
}
declare class RemoteExecutor implements BackendExecutor {
    private transport;
    private loadBalancer?;
    private callbackRegistry;
    private sessionId;
    constructor(options: RemoteExecutorOptions);
    private initCallbackListener;
    private prepareMessage;
    execute<T = unknown, R = unknown>(command: Message<T>): Promise<R>;
    query<T = unknown, R = unknown>(query: Message<T>): Promise<R>;
    subscribe(channel: string, handler: (event: Message) => void): () => void;
    emit(event: Message): Promise<void>;
    registerCallback(callback: CallbackFn): CallbackHandle;
    delegate<T = unknown, R = unknown>(delegation: Delegation<T>): Promise<R>;
    submitJob<T = unknown, R = unknown>(job: Partial<Job<T, R>>): Promise<Job<T, R>>;
    getSessionId(): string;
    getLoadBalancer(): LoadBalancer | undefined;
    getTransport(): ITransport;
}

export { type BackendContract, BackendExecutor, BackendInstance, BackendRegistry, type CallbackDefinition, CallbackFn, CallbackHandle, CallbackRegistry, ConcurrencyConflictError, ConcurrencyManager, Delegation, type DomainContract, EventBus, type EventDefinition, HealthMonitor, ITransport, IdempotencyManager, InProcessExecutor, Job, type JobDefinition, type JobHandler, JobScheduler, LoadBalancer, LockManager, Message, type OperationDefinition, RemoteExecutor, type RemoteExecutorOptions, ResourceVersion, RoutingStrategy, createEmptyContract };

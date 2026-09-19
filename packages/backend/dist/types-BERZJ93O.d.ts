/**
 * @file types.ts
 * @description Canonical protocol types, messages, jobs, callbacks, and resolution interfaces.
 */
type MessageType = 'COMMAND' | 'QUERY' | 'RESULT' | 'EVENT' | 'CALLBACK_REQUEST' | 'CALLBACK_RESULT' | 'JOB_SUBMIT' | 'JOB_PROGRESS' | 'JOB_RESULT' | 'ERROR' | 'ACK';
interface AuthContext {
    userId?: string;
    role?: string;
    permissions?: string[];
    token?: string;
}
interface CapabilityContext {
    domain: string;
    capability: string;
    scope?: string;
}
interface Message<T = unknown> {
    id: string;
    type: MessageType;
    operation: string;
    payload?: T;
    sessionId?: string;
    correlationId?: string;
    causationId?: string;
    sequence?: number;
    timestamp: number;
    authContext?: AuthContext;
    capabilityContext?: CapabilityContext;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
interface CallbackHandle {
    id: string;
    sessionId: string;
    capability: string;
    expiration: number;
}
interface Delegation<T = unknown> {
    target: string;
    operation: string;
    payload: T;
    callbackHandle?: CallbackHandle;
    eventChannel?: string;
    sessionId?: string;
    correlationId?: string;
}
type JobState = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
interface Job<TPayload = unknown, TResult = unknown> {
    id: string;
    type: string;
    payload: TPayload;
    priority?: JobPriority;
    sequence?: number;
    sequenceKey?: string;
    dependencies?: string[];
    sessionId?: string;
    correlationId?: string;
    state: JobState;
    progress?: number;
    result?: TResult;
    error?: string;
    createdAt: number;
    updatedAt: number;
}
type ResolutionStrategy = 'LOCAL' | 'REMOTE' | 'REMOTE_FIRST' | 'LOCAL_FIRST';
interface ResourceVersion {
    version: number;
    updatedAt: number;
    checksum?: string;
}
interface DistributedLock {
    key: string;
    ownerId: string;
    leaseId: string;
    expiration: number;
}
interface BackendInstance {
    id: string;
    url: string;
    healthy: boolean;
    capacity: number;
    activeJobs: number;
    activeConnections: number;
    latencyMs: number;
    lastHeartbeat: number;
    weight?: number;
}
type RoutingStrategy = 'roundRobin' | 'weighted' | 'leastConnections' | 'latencyAware' | 'capacityAware';
interface IdempotentRequest<T = unknown> {
    id: string;
    idempotencyKey: string;
    operation: string;
    payload: T;
    timestamp: number;
}
interface BackendExecutor {
    execute<T = unknown, R = unknown>(command: Message<T>): Promise<R>;
    query<T = unknown, R = unknown>(query: Message<T>): Promise<R>;
    subscribe(channel: string, handler: (event: Message) => void): () => void;
    emit(event: Message): Promise<void>;
    registerCallback(callback: (...args: unknown[]) => unknown): CallbackHandle;
    delegate<T = unknown, R = unknown>(delegation: Delegation<T>): Promise<R>;
    submitJob<T = unknown, R = unknown>(job: Partial<Job<T, R>>): Promise<Job<T, R>>;
}

export type { AuthContext as A, BackendExecutor as B, CallbackHandle as C, Delegation as D, IdempotentRequest as I, Job as J, Message as M, ResolutionStrategy as R, BackendInstance as a, CapabilityContext as b, DistributedLock as c, JobPriority as d, JobState as e, MessageType as f, ResourceVersion as g, RoutingStrategy as h };

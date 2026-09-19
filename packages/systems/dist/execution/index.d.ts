/**
 * @file types.ts
 * @description Formal TypeScript types for SKIPO_EXECUTION system.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */
type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
type JobStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
interface RetryPolicy {
    maxAttempts: number;
    backoffMs: number;
    jitter?: boolean;
}
interface SkipoCommand<TPayload = unknown> {
    id: string;
    type: string;
    payload: TPayload;
    metadata?: Record<string, unknown>;
    correlationId: string;
    lifecycle?: string;
    createdAt: number;
}
interface ExecutionJob<TPayload = unknown> {
    id: string;
    command: SkipoCommand<TPayload>;
    idempotencyKey: string;
    correlationId: string;
    retryPolicy?: RetryPolicy;
    priority?: JobPriority;
    dependencies?: string[];
    status: JobStatus;
    progress?: number;
    attempts?: number;
    createdAt: number;
    updatedAt: number;
}
interface ExecutionResult<TResult = unknown> {
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
    data?: TResult;
    error?: string;
    executionTimeMs?: number;
}
interface ExecutionQueueAdapter {
    enqueue<T = unknown>(job: ExecutionJob<T>): Promise<string>;
    getJobStatus(jobId: string): Promise<JobStatus | undefined>;
    getJobResult<R = unknown>(jobId: string): Promise<ExecutionResult<R> | undefined>;
    cancel(jobId: string): Promise<boolean>;
    close(): Promise<void>;
}

/**
 * @file BullMQAdapter.ts
 * @description BullMQ Queue adapter with high-fidelity in-memory fallback.
 * Implements priority scheduling, retry policy, and concurrency control.
 */

interface BullMQAdapterOptions {
    queueName: string;
    connection?: {
        host?: string;
        port?: number;
        url?: string;
    };
    maxConcurrency?: number;
    useInMemory?: boolean;
}
declare class BullMQAdapter implements ExecutionQueueAdapter {
    private queue?;
    private worker?;
    private inMemoryJobs;
    private inMemoryResults;
    private inMemoryListeners;
    private isInMemory;
    constructor(options: BullMQAdapterOptions);
    enqueue<T = unknown>(job: ExecutionJob<T>): Promise<string>;
    getJobStatus(jobId: string): Promise<JobStatus | undefined>;
    getJobResult<R = unknown>(jobId: string): Promise<ExecutionResult<R> | undefined>;
    completeInMemoryJob(jobId: string, result: ExecutionResult<any>): void;
    subscribeInMemoryJob(jobId: string, listener: (res: ExecutionResult<any>) => void): () => void;
    getQueuedInMemoryJobs(): ExecutionJob<any>[];
    cancel(jobId: string): Promise<boolean>;
    close(): Promise<void>;
    private getPriorityNumber;
}

/**
 * @file CommandBus.ts
 * @description Frontend Command factory & enqueue transport boundary.
 * Enforces Invariants I7-I10: all backend-bound operations MUST go through commands.
 */

interface EnqueueOptions {
    idempotencyKey?: string;
    correlationId?: string;
    priority?: JobPriority;
    retryPolicy?: RetryPolicy;
    dependencies?: string[];
}
declare class CommandBus {
    private adapter;
    constructor(adapter: BullMQAdapter);
    createCommand<TPayload = unknown>(type: string, payload: TPayload, metadata?: Record<string, unknown>, lifecycle?: string): SkipoCommand<TPayload>;
    enqueue<TPayload = unknown>(command: SkipoCommand<TPayload>, options?: EnqueueOptions): Promise<ExecutionJob<TPayload>>;
}

/**
 * @file SkipoExecution.ts
 * @description Canonical SKIPO_EXECUTION system orchestrator.
 * Connects BullMQ queues, CommandBus, and SKIPO_STATE result flow.
 */

declare class SkipoExecutionEngine {
    readonly frontendQueue: BullMQAdapter;
    readonly backendQueue: BullMQAdapter;
    readonly commandBus: CommandBus;
    constructor(options?: {
        redisConnection?: {
            host?: string;
            port?: number;
            url?: string;
        };
    });
    createCommand<TPayload = unknown>(type: string, payload: TPayload, metadata?: Record<string, unknown>, lifecycle?: string): SkipoCommand<TPayload>;
    dispatch<TPayload = unknown>(type: string, payload: TPayload, options?: EnqueueOptions): Promise<ExecutionJob<TPayload>>;
    propagateResult<TResult = unknown>(correlationId: string, result: ExecutionResult<TResult>): void;
    close(): Promise<void>;
}
declare const SKIPO_EXECUTION: SkipoExecutionEngine;

/**
 * @file hooks.ts
 * @description React integration hooks for SKIPO_EXECUTION.
 * Routes all frontend mutations through BullMQ commands and reflects updates into SKIPO_STATE.
 */

interface CommandExecutionState<TResult = unknown> {
    status: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    correlationId?: string;
    data?: TResult;
    error?: string;
    completedAt?: number;
}
declare function useCommand<TPayload = unknown, TResult = unknown>(type: string, defaultOptions?: EnqueueOptions): {
    dispatch: (payload: TPayload, options?: Partial<EnqueueOptions>) => Promise<ExecutionJob<TPayload>>;
    status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "IDLE";
    isPending: boolean;
    result: TResult | undefined;
    error: string | undefined;
    correlationId: string | undefined;
};

export { BullMQAdapter, type BullMQAdapterOptions, CommandBus, type CommandExecutionState, type EnqueueOptions, type ExecutionJob, type ExecutionQueueAdapter, type ExecutionResult, type JobPriority, type JobStatus, type RetryPolicy, SKIPO_EXECUTION, type SkipoCommand, SkipoExecutionEngine, useCommand };

import { I as IdempotencyManager } from '../IdempotencyManager-B5MjK871.js';
import { J as Job } from '../types-BERZJ93O.js';

/**
 * @file types.ts
 * @description Formal TypeScript types for backend execution boundary.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */
interface ExecutionContext {
    isWorkerContext: boolean;
    workerId?: string;
    timestamp: number;
}
interface BackendCommand<TPayload = unknown> {
    id: string;
    type: string;
    payload: TPayload;
    metadata?: Record<string, unknown>;
    correlationId: string;
    idempotencyKey?: string;
    createdAt: number;
}
interface NormalizedResult<TData = unknown> {
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
    data?: TData;
    error?: string;
    executionTimestamp: number;
}
interface OperationComponent<TInput = unknown, TOutput = unknown> {
    name: string;
    execute(input: TInput): Promise<TOutput>;
}
interface DomainService {
    name: string;
    operations: Record<string, OperationComponent<any, any>>;
    execute(operationName: string, input: unknown): Promise<unknown>;
}

/**
 * @file OperationComponent.ts
 * @description Smallest deterministic executable domain operation.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

declare function createOperationComponent<TInput = unknown, TOutput = unknown>(name: string, handler: (input: TInput) => Promise<TOutput> | TOutput): OperationComponent<TInput, TOutput>;

/**
 * @file ServiceDispatcher.ts
 * @description Domain-level orchestration unit coordinating OperationComponents.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

declare class ServiceDispatcher implements DomainService {
    readonly name: string;
    operations: Record<string, OperationComponent<any, any>>;
    constructor(name: string);
    registerOperation<TIn = unknown, TOut = unknown>(opName: string, operation: OperationComponent<TIn, TOut>): this;
    execute(operationName: string, input: unknown): Promise<unknown>;
}

/**
 * @file BackendFacade.ts
 * @description Single Public Execution Interface for the backend plane.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

declare class ExecutableBackendFacade {
    readonly name: string;
    private services;
    private idempotency;
    constructor(name: string, idempotency?: IdempotencyManager);
    registerService(service: ServiceDispatcher): this;
    executeCommand<T = unknown>(command: BackendCommand<any>, context: ExecutionContext): Promise<NormalizedResult<T>>;
}

/**
 * @file WorkerExecutionBoundary.ts
 * @description Worker execution boundary enforcing worker-only access to Backend Facade.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

declare class WorkerExecutionBoundary {
    readonly workerId: string;
    private facade;
    constructor(workerId: string, facade: ExecutableBackendFacade);
    processJob<T = unknown>(command: BackendCommand<any>): Promise<NormalizedResult<T>>;
    static assertWorkerContext(context?: ExecutionContext): void;
}

/**
 * @file DependencyOrdering.ts
 * @description Dependency graph ordering and race-condition prevention for jobs.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

declare class JobDependencyGraph {
    private scheduler;
    constructor(maxConcurrency?: number);
    registerHandler<TPayload = any, TResult = any>(type: string, handler: (job: Job<TPayload, TResult>) => Promise<TResult>): this;
    submitJob<TPayload = any, TResult = any>(type: string, payload: TPayload, dependencies?: string[], idempotencyKey?: string): Job<TPayload, TResult>;
    getJob(jobId: string): Job | undefined;
    clear(): void;
}

/**
 * @file ResultFlowBridge.ts
 * @description Bridges execution results back to frontend state update streams.
 * Conforms to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */

interface StateUpdateEvent<T = unknown> {
    type: 'SKIPO_STATE_UPDATE';
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
    data?: T;
    error?: string;
    timestamp: number;
}
declare class ResultFlowBridge {
    static formatStateUpdate<T = unknown>(result: NormalizedResult<T>): StateUpdateEvent<T>;
}

export { type BackendCommand, type DomainService, ExecutableBackendFacade, type ExecutionContext, JobDependencyGraph, type NormalizedResult, type OperationComponent, ResultFlowBridge, ServiceDispatcher, type StateUpdateEvent, WorkerExecutionBoundary, createOperationComponent };

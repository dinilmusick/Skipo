import { R as ResolutionStrategy, B as BackendExecutor, C as CallbackHandle, M as Message, J as Job } from './types-BERZJ93O.js';

/**
 * @file BackendResolver.ts
 * @description Topology resolution engine selecting between local in-process and remote execution adapters.
 */

interface BackendResolverOptions {
    strategy?: ResolutionStrategy;
    inProcessExecutor?: BackendExecutor;
    remoteExecutor?: BackendExecutor;
    remoteHealthCheck?: () => Promise<boolean>;
}
declare class BackendResolver {
    private strategy;
    private inProcessExecutor?;
    private remoteExecutor?;
    private remoteHealthCheck?;
    private activeExecutor?;
    constructor(options: BackendResolverOptions);
    setInProcessExecutor(executor: BackendExecutor): void;
    setRemoteExecutor(executor: BackendExecutor): void;
    setStrategy(strategy: ResolutionStrategy): void;
    getStrategy(): ResolutionStrategy;
    getActiveExecutor(): BackendExecutor | undefined;
    resolve(): Promise<BackendExecutor>;
    private checkRemoteHealth;
    failover(): Promise<BackendExecutor>;
    reconnect(): Promise<void>;
    health(): Promise<{
        local: boolean;
        remote: boolean;
        active: ResolutionStrategy;
    }>;
}

/**
 * @file CallbackRegistry.ts
 * @description Session-scoped callback registry converting JavaScript functions to opaque capability handles.
 */

type CallbackFn = (...args: any[]) => Promise<any> | any;
declare class CallbackRegistry {
    private entries;
    private defaultTtlMs;
    constructor(defaultTtlMs?: number);
    register(fn: CallbackFn, sessionId?: string, capability?: string, ttlMs?: number): CallbackHandle;
    invoke<TArgs extends any[] = any[], TReturn = any>(handle: CallbackHandle | string, args: TArgs, callerSessionId?: string): Promise<TReturn>;
    unregister(handleOrId: CallbackHandle | string): boolean;
    expire(handleOrId: CallbackHandle | string): void;
    pruneExpired(): number;
    clear(): void;
}

/**
 * @file SequenceTracker.ts
 * @description Monotonic sequence ordering detector identifying duplicates, out-of-order items, and sequence gaps.
 */
interface SequenceCheckResult {
    valid: boolean;
    isDuplicate: boolean;
    isOutOfOrder: boolean;
    hasGap: boolean;
    expected: number;
    received: number;
}
type GapHandler = (streamKey: string, expected: number, received: number) => Promise<void> | void;
declare class SequenceTracker {
    private lastSequences;
    private pausedStreams;
    private gapHandlers;
    record(streamKey: string, sequence: number): SequenceCheckResult;
    onGap(handler: GapHandler): () => void;
    private triggerGap;
    pause(streamKey: string): void;
    resume(streamKey: string, authoritativeSequence?: number): void;
    isPaused(streamKey: string): boolean;
    getLastSequence(streamKey: string): number;
    reset(streamKey?: string): void;
}

/**
 * @file FrontendSession.ts
 * @description Frontend session container tracking credentials, capabilities, callbacks, and sequence state.
 */

interface FrontendSessionOptions {
    sessionId?: string;
    credentials?: Record<string, string>;
    capabilities?: string[];
    callbackRegistry?: CallbackRegistry;
    sequenceTracker?: SequenceTracker;
}
declare class FrontendSession {
    readonly sessionId: string;
    private credentials;
    private capabilities;
    readonly callbackRegistry: CallbackRegistry;
    readonly sequenceTracker: SequenceTracker;
    private subscriptions;
    constructor(options?: FrontendSessionOptions);
    setCredential(key: string, value: string): this;
    getCredential(key: string): string | undefined;
    getCredentials(): Record<string, string>;
    grantCapability(capability: string): this;
    hasCapability(capability: string): boolean;
    trackSubscription(cleanup: () => void): () => void;
    clearSubscriptions(): void;
    dispose(): void;
}

interface BackendClientOptions {
    resolver: BackendResolver;
    session?: FrontendSession;
}
interface DomainProxy {
    on: (event: string, handler: (event: Message) => void) => () => void;
    subscribe: (channel: string, handler: (event: Message) => void) => () => void;
    execute: <T = any, R = any>(op: string, payload?: T) => Promise<R>;
    delegate: <T = any, R = any>(op: string, payload: T, callback?: (...args: any[]) => any) => Promise<R>;
    [operation: string]: any;
}
declare class BackendClient {
    readonly resolver: BackendResolver;
    readonly session: FrontendSession;
    private domainProxies;
    constructor(options: BackendClientOptions);
    domain(domainName: string): DomainProxy;
    private createDomainProxy;
    on(eventPattern: string, handler: (event: Message) => void): () => void;
    subscribe(channel: string, handler: (event: Message) => void): () => void;
    get jobs(): {
        submit: <T = any, R = any>(job: Partial<Job<T, R>> & {
            type: string;
            payload: T;
        }) => Promise<Job<T, R>>;
    };
    health(): Promise<{
        local: boolean;
        remote: boolean;
        active: ResolutionStrategy;
    }>;
}
declare function createBackendClient(options: BackendClientOptions): BackendClient & Record<string, DomainProxy>;

/**
 * @file EventBus.ts
 * @description Real-time anti-polling EventBus with channel subscriptions, sequence tagging, and buffer replay.
 */

type EventHandler = (event: Message) => void;
declare class EventBus {
    private listeners;
    private buffer;
    private maxBufferSize;
    private sequenceCounter;
    emit(eventOrType: Message | string, payload?: unknown): Message;
    subscribe(channel: string, handler: EventHandler): () => void;
    unsubscribe(channel: string, subscriptionId: string): void;
    getBuffer(sinceSequence?: number, channel?: string): Message[];
    getCurrentSequence(): number;
    clear(): void;
}

/**
 * @file Transport.ts
 * @description Pluggable transport abstraction decoupling business logic from underlying network protocols.
 */

type MessageHandler = (message: Message) => void;
type ErrorHandler = (error: Error) => void;
interface ITransport {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    request<T = unknown, R = unknown>(message: Message<T>): Promise<Message<R>>;
    send<T = unknown>(message: Message<T>): Promise<void>;
    subscribe(channel: string, handler?: MessageHandler): () => void;
    unsubscribe(channel: string): void;
    onMessage(handler: MessageHandler): () => void;
    onError(handler: ErrorHandler): () => void;
}

/**
 * @file HTTPTransport.ts
 * @description Standard HTTP/SSE implementation of ITransport with correlation tracking and event streaming.
 */

interface HTTPTransportOptions {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
    timeoutMs?: number;
    eventsPath?: string;
}
declare class HTTPTransport implements ITransport {
    private baseUrl;
    private defaultHeaders;
    private timeoutMs;
    private eventsPath;
    private connected;
    private messageHandlers;
    private errorHandlers;
    private eventSourceAbort?;
    constructor(options: HTTPTransportOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    request<T = unknown, R = unknown>(message: Message<T>): Promise<Message<R>>;
    send<T = unknown>(message: Message<T>): Promise<void>;
    subscribe(_channel: string, handler?: MessageHandler): () => void;
    unsubscribe(_channel: string): void;
    onMessage(handler: MessageHandler): () => void;
    onError(handler: ErrorHandler): () => void;
    private notifyError;
    private startEventStream;
}

/**
 * @file WebSocketTransport.ts
 * @description Full-duplex WebSocket implementation of ITransport with auto-reconnect and heartbeat.
 */

interface WebSocketTransportOptions {
    url: string;
    heartbeatIntervalMs?: number;
    reconnectDelayMs?: number;
    maxReconnectAttempts?: number;
}
declare class WebSocketTransport implements ITransport {
    private url;
    private ws;
    private connected;
    private messageHandlers;
    private errorHandlers;
    private pendingRequests;
    private heartbeatTimer;
    private heartbeatIntervalMs;
    private reconnectDelayMs;
    constructor(options: WebSocketTransportOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    request<T = unknown, R = unknown>(message: Message<T>): Promise<Message<R>>;
    send<T = unknown>(message: Message<T>): Promise<void>;
    subscribe(channel: string, handler?: MessageHandler): () => void;
    unsubscribe(channel: string): void;
    onMessage(handler: MessageHandler): () => void;
    onError(handler: ErrorHandler): () => void;
    private startHeartbeat;
    private scheduleNextHeartbeat;
    private stopHeartbeat;
    getReconnectDelay(): number;
}

export { BackendClient as B, type CallbackFn as C, type DomainProxy as D, type ErrorHandler as E, FrontendSession as F, type GapHandler as G, HTTPTransport as H, type ITransport as I, type MessageHandler as M, type SequenceCheckResult as S, WebSocketTransport as W, type BackendClientOptions as a, BackendResolver as b, type BackendResolverOptions as c, CallbackRegistry as d, EventBus as e, type EventHandler as f, type FrontendSessionOptions as g, type HTTPTransportOptions as h, SequenceTracker as i, type WebSocketTransportOptions as j, createBackendClient as k };

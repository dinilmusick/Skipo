import { ZodTypeAny } from 'zod';
import { ExecOptions, SpawnOptions } from 'child_process';
import fs from 'fs';

/** Standard result type for operations that can fail */
type Result<T, E = Error> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
/** Standard logger interface */
interface Logger {
    log(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug?(message: string, ...args: unknown[]): void;
}
/** Disposable resource interface */
interface Disposable {
    dispose(): Promise<void>;
}
/** Generic provider interface */
interface Provider<_T = unknown> {
    initialize(): Promise<void>;
    dispose(): Promise<void>;
    isInitialized(): boolean;
}
/** Configuration for any Skipo component */
interface SkipoConfig {
    name: string;
    logger?: Logger;
    [key: string]: unknown;
}

/**
 * SkipoBase — Abstract foundation class for all Skipo components.
 * Provides lifecycle management, logging, and unique identification.
 * All @skipo/* classes should extend this.
 */
declare abstract class SkipoBase implements Disposable {
    /** Unique instance identifier */
    readonly instanceId: string;
    /** Human-readable component name */
    readonly name: string;
    /** Logger instance */
    protected readonly logger: Logger;
    /** Whether this component has been initialized */
    protected initialized: boolean;
    /** Whether this component has been disposed */
    protected disposed: boolean;
    constructor(config?: SkipoConfig);
    /** Initialize the component. Call before use. */
    initialize(): Promise<void>;
    /** Override to add custom initialization logic */
    protected onInitialize(): Promise<void>;
    /** Dispose the component and release resources */
    dispose(): Promise<void>;
    /** Override to add custom cleanup logic */
    protected onDispose(): Promise<void>;
    /** Guard: throws if not initialized */
    protected ensureInitialized(): void;
    /** Guard: throws if already disposed */
    protected ensureNotDisposed(): void;
}

/**
 * @file string.ts
 * @description String case conversions, UUID & ShortID generators, and minimal template interpolation.
 */
declare function toCamelCase(str: string): string;
declare function toPascalCase(str: string): string;
declare function toSnakeCase(str: string): string;
declare function toKebabCase(str: string): string;
declare function toScreamingSnake(str: string): string;
declare function toSlug(str: string): string;
declare function uuid(): string;
declare function shortId(length?: number): string;
declare function prefixedId(prefix: string, length?: number): string;
declare function interpolate(tmpl: string, data: Record<string, any>): string;

/**
 * @file async.ts
 * @description sleep, withTimeout, retry, pLimit, debounce, throttle, once, and memoize primitives.
 */
/**
 * Classic sleep/delay.
 */
declare function sleep(ms: number): Promise<void>;
/**
 * Rejects if the task does not finish within ms.
 */
declare function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T>;
/**
 * Retries an async execution up to maxAttempts times.
 */
declare function retry<T>(fn: () => Promise<T>, maxAttempts: number, delayMs?: number): Promise<T>;
/**
 * Limits concurrent async task execution.
 */
declare function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]>;
/**
 * Debounces a function.
 */
declare function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void;
/**
 * Throttles a function.
 */
declare function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void;
/**
 * Wraps a function to run only once and cache its outcome.
 */
declare function once<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
/**
 * Computational memoization cache helper.
 */
declare function memoize<T extends (...args: any[]) => any>(fn: T, keyFn?: (...args: Parameters<T>) => string): (...args: Parameters<T>) => ReturnType<T>;

/**
 * @file object.ts
 * @description Deep clone, deep merge, deep equal, object diffing, and dot-notation in-memory path accessor tools.
 */
/**
 * Structurally deep clones an object with circular dependency check.
 */
declare function deepClone<T>(obj: T, seen?: Map<any, any>): T;
/**
 * Recursively deep merges override objects into a base.
 */
declare function deepMerge(base: any, ...overrides: any[]): any;
/**
 * Performs a strict structural equality check.
 */
declare function deepEqual(a: any, b: any): boolean;
/**
 * Performs an object diff between before and after states.
 */
declare function objectDiff(before: any, after: any): {
    added: any;
    removed: any;
    changed: any;
};
/**
 * Accesses an in-memory object by dot-notation.
 */
declare function getPath(obj: any, path: string, defaultValue?: any): any;
/**
 * Mutates or sets an in-memory object by dot-notation.
 */
declare function setPath(obj: any, path: string, value: any): any;

/**
 * @file cache.ts
 * @description LRU cache, TTL cache, Stale-While-Revalidate, and File-system persistent caching.
 */
declare class LRUCache<K, V> {
    private maxSize;
    private cache;
    constructor(maxSize: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    delete(key: K): boolean;
    clear(): void;
    size(): number;
}
declare class TTLCache<K, V> {
    private ttlMs;
    private cache;
    constructor(ttlMs: number);
    get(key: K): V | null;
    set(key: K, value: V): void;
    delete(key: K): boolean;
    clear(): void;
}
/**
 * Stale-While-Revalidate utility.
 */
declare function swr<K, V>(cache: TTLCache<K, V>, key: K, fetchFn: () => Promise<V>): Promise<V>;
declare class FileCache<T> {
    private cacheDir;
    constructor(cacheDir: string);
    private getFilePath;
    get(key: string): T | null;
    set(key: string, value: T): void;
    delete(key: string): void;
    clear(): void;
}

/**
 * @file env.ts
 * @description Type-safe environment loading and config validation tool.
 */

/**
 * Reads a process environment variable with type coercion and defaults.
 */
declare function getEnv<T>(key: string, defaultValue?: T): T;
/**
 * Asserts environment variable is set and returns its string value.
 */
declare function requireEnv(key: string): string;
/**
 * Loads a .env file and injects variables into process.env.
 */
declare function loadEnv(filePath?: string): void;
/**
 * Validates the entire config using a Zod schema.
 */
declare function validateEnvSchema<T extends ZodTypeAny>(zodSchema: T): T['_output'];
/**
 * Checks if a connection string is a placeholder or template value.
 */
declare function isPlaceholderConnection(url?: string): boolean;
/**
 * Sanitizes a database URL, returning undefined if it is empty or a placeholder.
 */
declare function sanitizeDatabaseUrl(url?: string): string | undefined;

/**
 * @file http.ts
 * @description Safe, type-safe HTTP client wrapper.
 */
interface SkipoHTTPOptions extends RequestInit {
    timeout?: number;
    retries?: number;
}
interface SkipoHTTPResult<T> {
    status: "success" | "error";
    data?: T;
    message?: string;
    code?: number;
}
/**
 * Helper to perform fetch with timeout and retries.
 */
declare function requestRaw(url: string, opts?: SkipoHTTPOptions): Promise<Response>;
declare function request<T>(url: string, opts?: SkipoHTTPOptions): Promise<SkipoHTTPResult<T>>;
declare function get<T>(url: string, opts?: SkipoHTTPOptions): Promise<SkipoHTTPResult<T>>;
declare function post<T>(url: string, body: any, opts?: SkipoHTTPOptions): Promise<SkipoHTTPResult<T>>;
declare function put<T>(url: string, body: any, opts?: SkipoHTTPOptions): Promise<SkipoHTTPResult<T>>;
declare function del<T>(url: string, opts?: SkipoHTTPOptions): Promise<SkipoHTTPResult<T>>;
/**
 * Creates a client instance.
 */
declare function createClient(baseUrl: string, defaultHeaders?: Record<string, string>): {
    get: <T>(path: string, opts?: SkipoHTTPOptions) => Promise<SkipoHTTPResult<T>>;
    post: <T>(path: string, body: any, opts?: SkipoHTTPOptions) => Promise<SkipoHTTPResult<T>>;
    put: <T>(path: string, body: any, opts?: SkipoHTTPOptions) => Promise<SkipoHTTPResult<T>>;
    del: <T>(path: string, opts?: SkipoHTTPOptions) => Promise<SkipoHTTPResult<T>>;
};
/**
 * Streaming SSE / Chunk response.
 */
declare function streamResponse(url: string, opts?: SkipoHTTPOptions): AsyncIterable<string>;

/**
 * @file shell.ts
 * @description Safe promise-based exec and spawn wrappers with cross-platform command routing.
 */

interface SpawnHandle {
    pid?: number;
    kill: (signal?: NodeJS.Signals | number) => boolean;
    promise: Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
    }>;
}
/**
 * Promisified command execution.
 */
declare function execCmd(cmd: string, opts?: ExecOptions & {
    timeout?: number;
}): Promise<{
    stdout: string;
    stderr: string;
}>;
/**
 * Streaming command execution.
 */
declare function spawnCmd(cmd: string, args: string[], opts?: SpawnOptions): SpawnHandle;
/**
 * Defines posix vs win32 specific commands.
 */
declare function platform<T>(routing: {
    posix: T;
    win32: T;
}): T;
/**
 * Resolves the full path of a binary.
 */
declare function which(cmd: string): string | null;

/**
 * @file fs-lock.ts
 * @description File locking primitive for atomic file operations.
 */
type ReleaseFn = () => void;
declare class FileLock {
    private static locks;
    static acquire(filePath: string): Promise<ReleaseFn>;
}

/**
 * @file fs.ts
 * @description Robust cross-platform filesystem abstraction layer.
 */

declare function readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
declare function writeFile(filePath: string, content: string | Buffer): Promise<void>;
/**
 * Atomic file writing via temp files.
 */
declare function writeFileAtomic(filePath: string, content: string | Buffer): Promise<void>;
declare function appendFile(filePath: string, content: string | Buffer): Promise<void>;
declare function deleteFile(filePath: string): Promise<void>;
declare function fileExists(filePath: string): Promise<boolean>;
declare function getFileStat(filePath: string): Promise<{
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    isDir: boolean;
}>;
declare function readJSON<T>(filePath: string): Promise<T | null>;
declare function writeJSON(filePath: string, data: unknown, indent?: number): Promise<void>;
declare function updateJSON<T>(filePath: string, patch: Partial<T>): Promise<T>;
declare function ensureDir(dirPath: string): Promise<void>;
declare function deleteDir(dirPath: string, recursive?: boolean): Promise<void>;
declare function listDir(dirPath: string): Promise<string[]>;
declare function walkDir(dirPath: string, filter?: (file: string) => boolean): AsyncIterable<string>;
declare function dirExists(dirPath: string): Promise<boolean>;
declare function copyDir(src: string, dest: string): Promise<void>;
declare function firstExisting(candidates: string[]): Promise<string | null>;
declare function watchFile(filePath: string, handler: (event: string) => void, debounceMs?: number): fs.FSWatcher;
declare function watchDir(dirPath: string, handler: (event: string, filename: string | null) => void, debounceMs?: number): fs.FSWatcher;
declare function createTempFile(prefix?: string): string;
declare function createTempDir(prefix?: string): string;
declare function withTempDir<T>(fn: (tempDir: string) => Promise<T>, prefix?: string): Promise<T>;

/**
 * @file events.ts
 * @description Skipo Universal Real-Time Event Bus. Facilitates real-time event broadcasting and streaming.
 */
interface RealtimeWorkspaceEvent {
    id: string;
    timestamp: number;
    userId?: string;
    workspaceId?: string;
    source: 'api' | 'ui';
    method?: string;
    endpoint?: string;
    action: 'DOCUMENT_CREATED' | 'DOCUMENT_UPDATED' | 'DOCUMENT_DELETED' | 'CATEGORY_CREATED' | 'CATEGORY_UPDATED' | 'CATEGORY_DELETED' | 'GRAPH_UPDATED' | 'BIOME_CHANGED' | 'WORKSPACE_UPDATED' | 'WORKSPACE_SWITCHED' | 'GENERIC_ACTION' | string;
    details?: string;
    payload?: any;
}
type EventListener = (event: RealtimeWorkspaceEvent) => void;
/**
 * Publish a new event to all active real-time subscribers and store in buffer.
 */
declare function publishRealtimeEvent(eventInput: Omit<RealtimeWorkspaceEvent, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: number;
}): RealtimeWorkspaceEvent;
/**
 * Subscribe to real-time events. Returns an unsubscribe function.
 */
declare function subscribeRealtimeEvents(listener: EventListener): () => void;
/**
 * Retrieve recent events since a specified timestamp, optionally filtered by workspaceId or userId.
 */
declare function getRecentEvents(sinceTimestamp?: number, workspaceId?: string, userId?: string): RealtimeWorkspaceEvent[];

export { type Disposable, type EventListener, FileCache, FileLock, LRUCache, type Logger, type Provider, type RealtimeWorkspaceEvent, type ReleaseFn, type Result, SkipoBase, type SkipoConfig, type SkipoHTTPOptions, type SkipoHTTPResult, type SpawnHandle, TTLCache, appendFile, copyDir, createClient, createTempDir, createTempFile, debounce, deepClone, deepEqual, deepMerge, del, deleteDir, deleteFile, dirExists, ensureDir, execCmd, fileExists, firstExisting, get, getEnv, getFileStat, getPath, getRecentEvents, interpolate, isPlaceholderConnection, listDir, loadEnv, memoize, objectDiff, once, pLimit, platform, post, prefixedId, publishRealtimeEvent, put, readFile, readJSON, request, requestRaw, requireEnv, retry, sanitizeDatabaseUrl, setPath, shortId, sleep, spawnCmd, streamResponse, subscribeRealtimeEvents, swr, throttle, toCamelCase, toKebabCase, toPascalCase, toScreamingSnake, toSlug, toSnakeCase, updateJSON, uuid, validateEnvSchema, walkDir, watchDir, watchFile, which, withTempDir, withTimeout, writeFile, writeFileAtomic, writeJSON };

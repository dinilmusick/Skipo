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

export { IdempotencyManager as I };

// ══════════════════════════════════════════════════════════════════════════════════════════
// RESOURCE BUDGET & CONCURRENCY GOVERNOR
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 6 & 7 of the API Security & Resource Governance Spec:
// - max_body_size, max_query_size, max_parameter_size, max_execution_time, max_concurrency
// - Pagination clamp: limit <= MAX_PAGE_SIZE (Unbounded queries strictly forbidden)

import { ResourceLimitsConfig } from './types';

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimitsConfig> = {
  maxBodySize: 256 * 1024, // 256 KB
  maxQuerySize: 2048, // 2 KB query string
  maxParameterSize: 1024, // 1 KB per parameter
  maxExecutionMs: 10 * 1000, // 10s default execution timeout
  executionTimeoutMs: 10 * 1000, // Alias
  maxConcurrency: 20, // 20 concurrent requests per identity
  maxPageSize: 100, // Max 100 items per collection query
};


// In-flight concurrency map preserved across HMR
const globalStoreKey = Symbol.for('__docustack_governance_concurrency_store__');
type GlobalWithConcurrency = typeof globalThis & {
  [globalStoreKey]?: Map<string, number>;
};

const inFlightMap: Map<string, number> =
  (globalThis as GlobalWithConcurrency)[globalStoreKey] || new Map<string, number>();
(globalThis as GlobalWithConcurrency)[globalStoreKey] = inFlightMap;

/**
 * Attempts to acquire a concurrency execution slot for an identity on a route.
 */
export function acquireConcurrencySlot(
  slotKey: string,
  maxConcurrency: number = DEFAULT_RESOURCE_LIMITS.maxConcurrency
): { acquired: boolean; currentCount: number } {
  const current = inFlightMap.get(slotKey) || 0;
  if (current >= maxConcurrency) {
    return { acquired: false, currentCount: current };
  }
  inFlightMap.set(slotKey, current + 1);
  return { acquired: true, currentCount: current + 1 };
}

/**
 * Releases a previously acquired concurrency execution slot.
 */
export function releaseConcurrencySlot(slotKey: string): void {
  const current = inFlightMap.get(slotKey) || 0;
  if (current <= 1) {
    inFlightMap.delete(slotKey);
  } else {
    inFlightMap.set(slotKey, current - 1);
  }
}

/**
 * Clamps requested pagination limits to the defined maximum page size.
 * Section 7: requestedLimit > MAX_PAGE_SIZE => requestedLimit = MAX_PAGE_SIZE
 */
export function clampPaginationLimit(
  requestedLimit: number | string | null | undefined,
  maxPageSize: number = DEFAULT_RESOURCE_LIMITS.maxPageSize
): number {
  if (requestedLimit === null || requestedLimit === undefined) {
    return 50; // Canonical default page size
  }
  const parsed = typeof requestedLimit === 'string' ? parseInt(requestedLimit, 10) : requestedLimit;
  if (isNaN(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, maxPageSize);
}

/**
 * Wraps an asynchronous handler execution with a strict timeout limit.
 * Terminate operation with HTTP 408 on timeout.
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out.'
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

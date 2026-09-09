/**
 * @fileoverview API Governance Resource Budget Template
 */

export const governanceBudgetTemplate = () => `import { ResourceLimitsConfig } from './types';

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimitsConfig> = {
  maxBodySizeBytes: 1048576, // 1MB
  maxQueryLength: 2048,
  maxParamLength: 256,
  timeoutMs: 8000,
  executionTimeoutMs: 8000,
  maxPaginationLimit: 100,
  maxConcurrencySlots: 25
};

const activeSlotsByRoute = new Map<string, number>();

export function acquireConcurrencySlot(routeKey: string, maxSlots = 25): boolean {
  const current = activeSlotsByRoute.get(routeKey) || 0;
  if (current >= maxSlots) return false;
  activeSlotsByRoute.set(routeKey, current + 1);
  return true;
}

export function releaseConcurrencySlot(routeKey: string): void {
  const current = activeSlotsByRoute.get(routeKey) || 0;
  if (current <= 1) {
    activeSlotsByRoute.delete(routeKey);
  } else {
    activeSlotsByRoute.set(routeKey, current - 1);
  }
}

export function clampPaginationLimit(limit: number | undefined, maxLimit = 100): number {
  if (!limit || isNaN(limit) || limit <= 0) return 50;
  return Math.min(limit, maxLimit);
}

export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Request execution timed out'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}
`;

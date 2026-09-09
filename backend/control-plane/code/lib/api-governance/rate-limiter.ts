// ══════════════════════════════════════════════════════════════════════════════════════════
// API RATE LIMITING ENGINE (TIERED & SLIDING WINDOW)
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 4 of the API Security & Resource Governance Spec:
// RATE_LIMIT := f(route, identity, time_window)
// CHEAP_READ -> High Limit (120 req / 60s)
// NORMAL_MUTATION -> Medium Limit (60 req / 60s)
// EXPENSIVE_OPERATION -> Low Limit (20 req / 60s)
// AUTHENTICATION -> Very Low Limit (15 req / 15m)

import { RateLimitConfig, RateLimitTier } from './types';

interface RateLimitBucket {
  count: number;
  resetAt: number;
  firstSeenAt: number;
}

const TIER_DEFAULTS: Record<RateLimitTier, { requests: number; windowMs: number }> = {
  CHEAP_READ: { requests: 120, windowMs: 60 * 1000 },
  NORMAL_MUTATION: { requests: 60, windowMs: 60 * 1000 },
  EXPENSIVE_OPERATION: { requests: 20, windowMs: 60 * 1000 },
  AUTHENTICATION: { requests: 25, windowMs: 15 * 60 * 1000 },
};

const DEFAULT_LIMIT = { requests: 60, windowMs: 60 * 1000 };

// In-memory bucket store preserved across hot module reloads
const globalStoreKey = Symbol.for('__docustack_governance_rate_limiter_store__');
type GlobalWithStore = typeof globalThis & {
  [globalStoreKey]?: Map<string, RateLimitBucket>;
};

const store: Map<string, RateLimitBucket> =
  (globalThis as GlobalWithStore)[globalStoreKey] || new Map<string, RateLimitBucket>();
(globalThis as GlobalWithStore)[globalStoreKey] = store;

// Periodic cleanup of expired entries every 2 minutes
if (typeof setInterval !== 'undefined') {
  const cleanupIntervalKey = Symbol.for('__docustack_rate_limit_cleanup_timer__');
  const globalWithTimer = globalThis as typeof globalThis & { [cleanupIntervalKey]?: NodeJS.Timeout };
  if (!globalWithTimer[cleanupIntervalKey]) {
    globalWithTimer[cleanupIntervalKey] = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of store.entries()) {
        if (now > bucket.resetAt) {
          store.delete(key);
        }
      }
    }, 2 * 60 * 1000);
    // Unref timer so it doesn't hold Node process open in test runners
    if (typeof globalWithTimer[cleanupIntervalKey]?.unref === 'function') {
      globalWithTimer[cleanupIntervalKey].unref();
    }
  }
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  totalLimit: number;
  resetAt: number;
}

/**
 * Evaluates rate limit against the tiered sliding window.
 */
export function checkGovernanceRateLimit(
  key: string,
  config?: RateLimitConfig,
  multiplier = 1.0
): RateLimitCheckResult {
  const now = Date.now();

  // 1. Resolve limits based on tier or explicit config
  let maxRequests = DEFAULT_LIMIT.requests;
  let windowMs = DEFAULT_LIMIT.windowMs;

  if (config?.tier && TIER_DEFAULTS[config.tier]) {
    maxRequests = TIER_DEFAULTS[config.tier].requests;
    windowMs = TIER_DEFAULTS[config.tier].windowMs;
  }

  if (typeof config?.requests === 'number' && config.requests > 0) {
    maxRequests = config.requests;
  }
  if (typeof config?.windowMs === 'number' && config.windowMs > 0) {
    windowMs = config.windowMs;
  }

  if (typeof multiplier === 'number' && multiplier > 0) {
    maxRequests = Math.max(1, Math.floor(maxRequests * multiplier));
  }

  // 2. Fetch or initialize bucket
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
      firstSeenAt: now,
    });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSec: 0,
      totalLimit: maxRequests,
      resetAt: now + windowMs,
    };
  }

  // 3. Exceeded limit check
  if (bucket.count >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      totalLimit: maxRequests,
      resetAt: bucket.resetAt,
    };
  }

  // 4. Increment count and allow
  bucket.count += 1;
  store.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.count),
    retryAfterSec: 0,
    totalLimit: maxRequests,
    resetAt: bucket.resetAt,
  };
}

export function resetGovernanceRateLimit(key: string): void {
  store.delete(key);
}

export function clearAllRateLimits(): void {
  store.clear();
}

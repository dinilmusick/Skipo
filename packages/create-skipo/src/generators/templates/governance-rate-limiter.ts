/**
 * @fileoverview API Governance Rate Limiter Template
 */

export const governanceRateLimiterTemplate = () => `import { RateLimitTier, RateLimitConfig } from './types';

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  CHEAP_READ: { capacity: 120, windowMs: 60 * 1000 },
  NORMAL_MUTATION: { capacity: 60, windowMs: 60 * 1000 },
  EXPENSIVE_OPERATION: { capacity: 20, windowMs: 60 * 1000 },
  AUTHENTICATION: { capacity: 25, windowMs: 15 * 60 * 1000 }
};

interface WindowBucket {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private buckets = new Map<string, WindowBucket>();

  public check(key: string, tier: RateLimitTier): { allowed: boolean; limit: number; remaining: number; resetMs: number } {
    const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.NORMAL_MUTATION;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= config.capacity) {
      const oldest = bucket.timestamps[0];
      const resetMs = oldest ? Math.max(0, oldest + config.windowMs - now) : config.windowMs;
      return { allowed: false, limit: config.capacity, remaining: 0, resetMs };
    }

    bucket.timestamps.push(now);
    return {
      allowed: true,
      limit: config.capacity,
      remaining: config.capacity - bucket.timestamps.length,
      resetMs: config.windowMs
    };
  }
}

export const rateLimiter = new InMemoryRateLimiter();
`;

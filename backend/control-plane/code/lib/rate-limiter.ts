// Simple in-memory rate limiter for authentication endpoints

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check and record an attempt.
 * @param key Identification key (IP address or email)
 * @param maxAttempts Maximum allowed attempts in window (default: 5)
 * @param windowMs Time window in milliseconds (default: 15 minutes = 900000ms)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSec: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  store.set(key, entry);
  return { allowed: true, remaining: maxAttempts - entry.count, retryAfterSec: 0 };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

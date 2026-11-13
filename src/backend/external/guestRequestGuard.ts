import type { GuestExternalPrincipal } from "./contract.js";

export interface GuestAbuseLimiter {
  /** Atomic sliding/fixed-window counter in a deployment-shared authority. */
  consume(key: string, limit: number, windowMs: number): Promise<boolean>;
  /** Atomic concurrency slot; return an idempotent release callback or null at capacity. */
  acquire(key: string, limit: number): Promise<(() => Promise<void> | void) | null>;
}
export interface GuestRequestGuardOptions {
  limiter: GuestAbuseLimiter;
  getClientIp(request: Request): string | null;
  allowedOrigins?: readonly string[];
  requestsPerIp?: number;
  requestsPerLease?: number;
  windowMs?: number;
  concurrentPerIp?: number;
  concurrentPerLease?: number;
  maxBodyBytes?: number;
}
const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

function validOrigin(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  if (!origin) return !mutating;
  if (origin === "null") return false;
  const allowed = new Set([new URL(request.url).origin, ...allowedOrigins]);
  return allowed.has(origin);
}

async function bodyWithinLimit(request: Request, maxBytes: number): Promise<boolean> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return false;
  if (!request.body) return true;
  const reader = request.clone().body?.getReader();
  if (!reader) return true;
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return true;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return false;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function withGuestRequestGuards<T extends Response | null>(
  request: Request,
  principal: GuestExternalPrincipal,
  options: GuestRequestGuardOptions | undefined,
  next: () => Promise<T>,
): Promise<T | Response> {
  if (!options) return json(503, "GUEST_GUARD_UNAVAILABLE", "Guest access is temporarily unavailable.") as T | Response;
  if (!validOrigin(request, options.allowedOrigins ?? [])) return json(403, "GUEST_ORIGIN_REJECTED", "Request origin is not allowed.") as T | Response;
  const maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) return json(503, "GUEST_GUARD_MISCONFIGURED", "Guest access is temporarily unavailable.") as T | Response;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase()) && !(await bodyWithinLimit(request, maxBodyBytes))) {
    return json(413, "GUEST_BODY_TOO_LARGE", "Request body exceeds the guest limit.") as T | Response;
  }
  let ip: string | null = null;
  try { ip = options.getClientIp(request); } catch { ip = null; }
  if (!ip || ip.length > 128) return json(503, "GUEST_CLIENT_ID_UNAVAILABLE", "Guest access is temporarily unavailable.") as T | Response;
  const requestsPerIp = options.requestsPerIp ?? 60;
  const requestsPerLease = options.requestsPerLease ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  const concurrentPerIp = options.concurrentPerIp ?? 10;
  const concurrentPerLease = options.concurrentPerLease ?? 5;
  if (![requestsPerIp, requestsPerLease, windowMs, concurrentPerIp, concurrentPerLease].every(value => Number.isSafeInteger(value) && value > 0)) {
    return json(503, "GUEST_GUARD_MISCONFIGURED", "Guest access is temporarily unavailable.") as T | Response;
  }
  const ipKey = "skipo-guest:ip:" + ip;
  const leaseKey = "skipo-guest:lease:" + principal.leaseId;
  let releaseIp: (() => Promise<void> | void) | null = null;
  let releaseLease: (() => Promise<void> | void) | null = null;
  try {
    if (!(await options.limiter.consume(ipKey, requestsPerIp, windowMs))) return json(429, "GUEST_RATE_LIMITED", "Guest request rate limit exceeded.") as T | Response;
    if (!(await options.limiter.consume(leaseKey, requestsPerLease, windowMs))) return json(429, "GUEST_RATE_LIMITED", "Guest request rate limit exceeded.") as T | Response;
    releaseIp = await options.limiter.acquire(ipKey, concurrentPerIp);
    if (!releaseIp) return json(429, "GUEST_CONCURRENCY_LIMITED", "Too many concurrent guest requests.") as T | Response;
    releaseLease = await options.limiter.acquire(leaseKey, concurrentPerLease);
    if (!releaseLease) return json(429, "GUEST_CONCURRENCY_LIMITED", "Too many concurrent guest requests.") as T | Response;
    return await next();
  } catch {
    return json(503, "GUEST_GUARD_UNAVAILABLE", "Guest access is temporarily unavailable.") as T | Response;
  } finally {
    try { await releaseLease?.(); } catch { /* release is retried by the shared limiter's lease expiry */ }
    try { await releaseIp?.(); } catch { /* release is retried by the shared limiter's lease expiry */ }
  }
}

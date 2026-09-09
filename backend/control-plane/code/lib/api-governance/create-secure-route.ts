// ══════════════════════════════════════════════════════════════════════════════════════════
// CANONICAL SECURE ROUTE FACTORY (THE 8-GATE FRAMEWORK GATEKEEPER)
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 1, 2, 3, 4, 5, 6, 8, 14, 15, 16, 17 of the Spec:
// Canonical 8-Gate Pipeline:
// [0. IP Blocklist] -> [1. Request Validation] -> [2. Auth] -> [3. Authorization] ->
// [4. Rate Limit] -> [5. Resource Limits] -> [6. Application Logic] -> [7. Response]
//
// Invariant: FAILURE_AT_ANY_GATE -> STOP -> NO_DOWNSTREAM_EXECUTION

import { NextRequest, NextResponse } from 'next/server';
import { RouteConfig, SecureRequestContext, SecureSession } from './types';
import { isIpBlocked, recordRequestAbuseMetrics } from './abuse-detector';
import { validateIncomingRequest } from './request-validator';
import { checkGovernanceRateLimit } from './rate-limiter';
import {
  acquireConcurrencySlot,
  releaseConcurrencySlot,
  executeWithTimeout,
  DEFAULT_RESOURCE_LIMITS,
} from './resource-budget';
import { applySecurityHeaders } from './security-headers';
import { handleSecureApiError } from './error-handler';
import { recordRequestMetric } from './observability';
import { verifySessionToken, findUserById, findUserByIdAsync } from '../auth-storage';
import { validateAccessToken } from './session-manager';
import {
  TRUST_RANK,
  getTrustRateMultiplier,
  computeAbuseScore,
  recordSuccessfulActivity,
  SUSPICIOUS_ABUSE_THRESHOLD,
} from './trust-engine';

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validates route configuration upon registration (Section 14).
 */
export function validateRouteConfig<TBody>(config: RouteConfig<TBody>): RouteConfig<TBody> {
  if (!config.id || typeof config.id !== 'string') {
    throw new Error('createSecureRoute requires a non-empty string "id".');
  }
  if (!config.method) {
    throw new Error(`createSecureRoute(${config.id}) requires an HTTP "method".`);
  }
  if (typeof config.handler !== 'function') {
    throw new Error(`createSecureRoute(${config.id}) requires an execution "handler" function.`);
  }
  return config;
}

/**
 * Extracts and verifies session credentials from headers, cookies, or query parameters.
 */
export async function authenticateRequest(req: NextRequest): Promise<SecureSession | null> {
  const cookieToken = req.cookies.get('docustack_session')?.value;
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  const queryToken = req.nextUrl.searchParams.get('token') || req.nextUrl.searchParams.get('sessionToken');

  const token = cookieToken || headerToken || queryToken;
  if (!token) return null;

  let accountId: string | null = null;
  let sessionId: string | undefined;

  const accessPayload = validateAccessToken(token);
  if (accessPayload) {
    accountId = accessPayload.accountId;
    sessionId = accessPayload.sessionId;
  } else {
    const sessionData = verifySessionToken(token);
    if (sessionData?.userId) {
      accountId = sessionData.userId;
      sessionId = sessionData.sessionId;
    }
  }

  if (!accountId) return null;

  let user = findUserById(accountId);
  if (!user) {
    user = await findUserByIdAsync(accountId);
  }
  if (!user) return null;

  return {
    userId: user.id,
    role: user.role,
    token,
    sessionId,
    accountId: user.id,
    trustLevel: user.trustLevel || (user.role === 'admin' ? 'T4_PRIVILEGED' : 'T0_UNVERIFIED'),
    emailVerified: user.emailVerified ?? (user.role === 'admin'),
    status: user.status || 'ACTIVE',
  };
}

/**
 * Canonical framework route creator.
 * Wraps route logic with strict 8-gate security pipeline.
 */
export function createSecureRoute<TBody = any>(
  routeConfig: RouteConfig<TBody>
): (
  req: NextRequest,
  routeContext: any
) => Promise<NextResponse | Response> {
  const config = validateRouteConfig(routeConfig);

  return async (req: NextRequest, routeContext: any = {}) => {
    const startTime = Date.now();
    const requestId = req.headers.get('x-request-id') || generateRequestId();

    const clientIp = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // ── GATE 0: IP BLOCKLIST & ABUSE SHIELD (0 CPU COST) ──────────────────────────────────
    const blockCheck = isIpBlocked(clientIp);
    if (blockCheck.blocked) {
      const blockedRes = NextResponse.json(
        {
          success: false,
          error: 'IP_BLOCKED',
          message: `Your IP has been temporarily blocked due to detected anomaly: ${blockCheck.reason || 'Excessive malicious traffic'}.`,
          retryAfterSec: blockCheck.retryAfterSec,
        },
        {
          status: 403,
          headers: { 'Retry-After': String(blockCheck.retryAfterSec || 900) },
        }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 403,
        durationMs: Date.now() - startTime,
        ip: clientIp,
        userAgent,
        errorCode: 'IP_BLOCKED',
      });
      return applySecurityHeaders(blockedRes, requestId);
    }

    // ── GATE 1: REQUEST VALIDATION (METHOD, HEADERS, BODY SIZE, SCHEMA) ───────────────────
    let resolvedParams: Record<string, string> = {};
    if (routeContext?.params) {
      resolvedParams =
        typeof (routeContext.params as any).then === 'function'
          ? await (routeContext.params as Promise<Record<string, string>>)
          : (routeContext.params as Record<string, string>);
    }

    const validation = await validateIncomingRequest<TBody>(req, config, resolvedParams);
    if (!validation.valid) {
      recordRequestAbuseMetrics(clientIp, validation.response.status);
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: validation.response.status,
        durationMs: Date.now() - startTime,
        ip: clientIp,
        userAgent,
        errorCode: 'VALIDATION_FAILED',
      });
      return applySecurityHeaders(validation.response, requestId);
    }

    // ── GATE 2: AUTHENTICATION (CHEAP CHECK BEFORE ANY EXPENSIVE OPERATION) ───────────────
    const isPublic =
      config.public === true ||
      config.auth === false ||
      (typeof config.auth === 'object' && config.auth?.required === false);
    const session = await authenticateRequest(req);

    if (!isPublic && !session) {
      recordRequestAbuseMetrics(clientIp, 401);
      const authRes = NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Valid authentication session required to access this endpoint.',
        },
        { status: 401 }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 401,
        durationMs: Date.now() - startTime,
        ip: clientIp,
        userAgent,
        errorCode: 'UNAUTHORIZED',
      });
      return applySecurityHeaders(authRes, requestId);
    }

    // Reject inactive/suspended accounts immediately
    if (session && session.status && session.status !== 'ACTIVE') {
      recordRequestAbuseMetrics(clientIp, 403);
      const suspendedRes = NextResponse.json(
        {
          success: false,
          error: 'ACCOUNT_SUSPENDED',
          message: `Account is ${session.status.toLowerCase()}. Access denied.`,
          status: session.status,
        },
        { status: 403 }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 403,
        durationMs: Date.now() - startTime,
        userId: session.userId,
        ip: clientIp,
        userAgent,
        errorCode: 'ACCOUNT_SUSPENDED',
      });
      return applySecurityHeaders(suspendedRes, requestId);
    }

    // ── GATE 3: AUTHORIZATION (ROLE & PERMISSION MATRIX) ──────────────────────────────────
    const requiredRole = typeof config.auth === 'object' ? config.auth?.role : undefined;
    if (requiredRole && session?.role !== requiredRole) {
      recordRequestAbuseMetrics(clientIp, 403);
      const forbidRes = NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: `Forbidden: role "${requiredRole}" required. Current role is "${session?.role || 'anonymous'}".`,
        },
        { status: 403 }
      );

      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 403,
        durationMs: Date.now() - startTime,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        errorCode: 'FORBIDDEN',
      });
      return applySecurityHeaders(forbidRes, requestId);
    }

    // Email verification gating
    if (config.emailVerificationRequired && (!session || !session.emailVerified)) {
      recordRequestAbuseMetrics(clientIp, 403);
      const emailRes = NextResponse.json(
        {
          success: false,
          error: 'EMAIL_VERIFICATION_REQUIRED',
          message: 'Email verification is required to access this endpoint.',
        },
        { status: 403 }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 403,
        durationMs: Date.now() - startTime,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        errorCode: 'EMAIL_VERIFICATION_REQUIRED',
      });
      return applySecurityHeaders(emailRes, requestId);
    }

    // Progressive trust level gating
    if (config.minimumTrustLevel) {
      const userTrust = session?.trustLevel || 'T0_UNVERIFIED';
      const userRank = TRUST_RANK[userTrust] ?? 0;
      const requiredRank = TRUST_RANK[config.minimumTrustLevel] ?? 0;
      if (userRank < requiredRank) {
        recordRequestAbuseMetrics(clientIp, 403);
        const trustRes = NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_TRUST_LEVEL',
            message: `Endpoint requires trust level "${config.minimumTrustLevel}". Current account trust is "${userTrust}".`,
            requiredTrustLevel: config.minimumTrustLevel,
            currentTrustLevel: userTrust,
          },
          { status: 403 }
        );
        recordRequestMetric({
          timestamp: startTime,
          requestId,
          route: config.id,
          method: req.method,
          status: 403,
          durationMs: Date.now() - startTime,
          userId: session?.userId,
          ip: clientIp,
          userAgent,
          errorCode: 'INSUFFICIENT_TRUST_LEVEL',
        });
        return applySecurityHeaders(trustRes, requestId);
      }
    }

    if (config.authorize) {
      const authorized = await config.authorize(session, req);
      if (!authorized) {
        recordRequestAbuseMetrics(clientIp, 403);
        const forbidRes = NextResponse.json(
          {
            success: false,
            error: 'FORBIDDEN',
            message: 'Forbidden: authorization policy rejected request.',
          },
          { status: 403 }
        );
        recordRequestMetric({
          timestamp: startTime,
          requestId,
          route: config.id,
          method: req.method,
          status: 403,
          durationMs: Date.now() - startTime,
          userId: session?.userId,
          ip: clientIp,
          userAgent,
          errorCode: 'POLICY_REJECTED',
        });
        return applySecurityHeaders(forbidRes, requestId);
      }
    }

    // ── GATE 4: RATE LIMITING (TIERED: USER OR IP) ─────────────────────────────────────────
    const rateLimitIdentity = session?.userId || clientIp;
    const strategy = config.rateLimit?.key || (session ? 'user+route' : 'ip+route');
    let rateLimitKey: string;

    switch (strategy) {
      case 'user':
        rateLimitKey = `user:${session?.userId || clientIp}`;
        break;
      case 'ip':
        rateLimitKey = `ip:${clientIp}`;
        break;
      case 'user+route':
        rateLimitKey = `route:${config.id}:user:${session?.userId || clientIp}`;
        break;
      case 'ip+route':
      default:
        rateLimitKey = `route:${config.id}:ip:${clientIp}`;
        break;
    }

    let trustMultiplier = session?.trustLevel ? getTrustRateMultiplier(session.trustLevel) : 1.0;
    if (session?.userId && computeAbuseScore(session.userId) >= SUSPICIOUS_ABUSE_THRESHOLD) {
      trustMultiplier *= 0.5;
    }

    const rateResult = checkGovernanceRateLimit(rateLimitKey, config.rateLimit, trustMultiplier);
    if (!rateResult.allowed) {
      recordRequestAbuseMetrics(clientIp, 429);
      const rateRes = NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests for ${config.id}. Rate limit exceeded. Try again in ${rateResult.retryAfterSec}s.`,
          retryAfterSec: rateResult.retryAfterSec,
          totalLimit: rateResult.totalLimit,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateResult.retryAfterSec),
            'X-RateLimit-Limit': String(rateResult.totalLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateResult.resetAt / 1000)),
          },
        }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 429,
        durationMs: Date.now() - startTime,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        rateLimitRemaining: 0,
        errorCode: 'RATE_LIMIT_EXCEEDED',
      });
      return applySecurityHeaders(rateRes, requestId);
    }

    // ── GATE 5: RESOURCE & CONCURRENCY LIMITS ─────────────────────────────────────────────
    const concurrencyKey = `${config.id}:${rateLimitIdentity}`;
    const maxConcurrency =
      config.limits?.maxConcurrency ??
      (config.rateLimit?.tier === 'EXPENSIVE_OPERATION' ? 10 : DEFAULT_RESOURCE_LIMITS.maxConcurrency);

    const slot = acquireConcurrencySlot(concurrencyKey, maxConcurrency);
    if (!slot.acquired) {
      recordRequestAbuseMetrics(clientIp, 429);
      const concurrencyRes = NextResponse.json(
        {
          success: false,
          error: 'CONCURRENCY_LIMIT_EXCEEDED',
          message: `Maximum concurrent in-flight requests (${maxConcurrency}) exceeded for route "${config.id}".`,
        },
        { status: 429 }
      );
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 429,
        durationMs: Date.now() - startTime,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        errorCode: 'CONCURRENCY_LIMIT_EXCEEDED',
      });
      return applySecurityHeaders(concurrencyRes, requestId);
    }

    // ── GATE 6: APPLICATION LOGIC WITH STRICT EXECUTION TIMEOUT ───────────────────────────
    const executionTimeoutMs =
      config.limits?.executionTimeoutMs ??
      config.limits?.maxExecutionMs ??
      DEFAULT_RESOURCE_LIMITS.maxExecutionMs;

    const executionContext: SecureRequestContext<TBody> = {
      session,
      requestId,
      ip: clientIp,
      userAgent,
      body: validation.body,
      query: validation.query,
      params: validation.params,
      isPublic,
    };

    try {
      const response = await executeWithTimeout(
        () => config.handler(req, executionContext),
        executionTimeoutMs,
        `Execution for ${config.id} exceeded budget of ${executionTimeoutMs}ms.`
      );

      // Attach rate limit telemetry headers
      response.headers.set('X-RateLimit-Limit', String(rateResult.totalLimit));
      response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateResult.resetAt / 1000)));

      // ── GATE 7: RESPONSE OBSERVABILITY & SECURITY HEADERS ─────────────────────────────────
      const durationMs = Date.now() - startTime;
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: response.status,
        durationMs,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        rateLimitRemaining: rateResult.remaining,
      });

      // Record successful activity for progressive trust elevation
      if (session?.userId && response.status >= 200 && response.status < 300) {
        recordSuccessfulActivity(session.userId);
      }

      return applySecurityHeaders(response, requestId);
    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        const timeoutRes = NextResponse.json(
          {
            success: false,
            error: 'EXECUTION_TIMEOUT',
            message: err.message,
            requestId,
          },
          { status: 408 }
        );
        recordRequestMetric({
          timestamp: startTime,
          requestId,
          route: config.id,
          method: req.method,
          status: 408,
          durationMs: Date.now() - startTime,
          userId: session?.userId,
          ip: clientIp,
          userAgent,
          errorCode: 'EXECUTION_TIMEOUT',
        });
        return applySecurityHeaders(timeoutRes, requestId);
      }

      // ── GATE 8: ERROR ISOLATION (SANITIZED 500, ZERO LEAK) ──────────────────────────────
      recordRequestAbuseMetrics(clientIp, 500);
      recordRequestMetric({
        timestamp: startTime,
        requestId,
        route: config.id,
        method: req.method,
        status: 500,
        durationMs: Date.now() - startTime,
        userId: session?.userId,
        ip: clientIp,
        userAgent,
        errorCode: 'INTERNAL_ERROR',
      });
      return handleSecureApiError(err, requestId, config.id);
    } finally {
      releaseConcurrencySlot(concurrencyKey);
    }
  };
}

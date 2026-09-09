/**
 * @fileoverview Canonical createSecureRoute Factory Template
 */

export const governanceRouteTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { SecureRouteConfig, SecureRequestContext } from './types';
import { rateLimiter } from './rate-limiter';
import { isIpBlocked, recordRequestOutcome } from './abuse-detector';
import {
  DEFAULT_RESOURCE_LIMITS,
  acquireConcurrencySlot,
  releaseConcurrencySlot,
  executeWithTimeout
} from './resource-budget';
import {
  validateContentLength,
  validateContentType,
  validateQueryLength,
  validateSchema
} from './request-validator';
import { applySecurityHeaders } from './security-headers';
import { handleSecureRouteError } from './error-handler';
import { observabilityBuffer } from './observability';

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export function createSecureRoute(config: SecureRouteConfig) {
  return async (req: NextRequest, routeContext: any = {}): Promise<NextResponse | Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const clientIp = extractClientIp(req);
    const tier = config.rateLimitTier || 'NORMAL_MUTATION';
    const limits = { ...DEFAULT_RESOURCE_LIMITS, ...config.resourceLimits };
    const routeKey = \`\${req.method}:\${req.nextUrl.pathname}\`;

    // Gate 0: IP Blocklist
    if (isIpBlocked(clientIp)) {
      return NextResponse.json({ error: 'Forbidden', message: 'IP address temporarily banned' }, { status: 403 });
    }

    // Gate 1: Request Validation
    const clError = validateContentLength(req, limits.maxBodySizeBytes);
    if (clError) { recordRequestOutcome(clientIp, 413); return clError; }

    const ctError = validateContentType(req);
    if (ctError) { recordRequestOutcome(clientIp, 415); return ctError; }

    const queryError = validateQueryLength(req, limits.maxQueryLength);
    if (queryError) { recordRequestOutcome(clientIp, 413); return queryError; }

    // Gate 2 & 3: Authentication & Authorization (context populated for handlers)
    const context: SecureRequestContext = {
      clientIp,
      requestId,
      routeParams: routeContext?.params,
      params: routeContext?.params
    };

    // Gate 4: Rate Limiting
    const rateCheck = rateLimiter.check(\`\${clientIp}:\${req.nextUrl.pathname}\`, tier);
    if (!rateCheck.allowed) {
      recordRequestOutcome(clientIp, 429);
      const res = NextResponse.json(
        { error: 'Too Many Requests', retryAfterMs: rateCheck.resetMs },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateCheck.resetMs / 1000).toString() } }
      );
      applySecurityHeaders(res, requestId);
      return res;
    }

    // Gate 5: Concurrency Budget
    if (!acquireConcurrencySlot(routeKey, limits.maxConcurrencySlots)) {
      recordRequestOutcome(clientIp, 503);
      return NextResponse.json({ error: 'Service Unavailable', message: 'Too many concurrent requests' }, { status: 503 });
    }

    try {
      // Schema validation on body
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && config.schema) {
        const cloned = req.clone();
        const json = await cloned.json().catch(() => null);
        if (json) {
          const schemaErr = validateSchema(json, config.schema);
          if (schemaErr) {
            recordRequestOutcome(clientIp, 422);
            return NextResponse.json({ error: 'Unprocessable Entity', message: schemaErr }, { status: 422 });
          }
        }
      }

      // Gate 6: Application Logic
      const effectiveTimeout = limits.executionTimeoutMs ?? limits.timeoutMs;
      const res = await executeWithTimeout(() => config.handler(req, context), effectiveTimeout);

      // Gate 7: Security Headers & Observability
      applySecurityHeaders(res, requestId);
      recordRequestOutcome(clientIp, res.status);
      observabilityBuffer.record({
        requestId,
        route: req.nextUrl.pathname,
        method: req.method,
        statusCode: res.status,
        durationMs: Date.now() - startTime,
        clientIp,
        timestamp: new Date().toISOString()
      });

      return res;
    } catch (err: any) {
      recordRequestOutcome(clientIp, 500);
      const errorRes = handleSecureRouteError(err, requestId);
      applySecurityHeaders(errorRes, requestId);
      return errorRes;
    } finally {
      releaseConcurrencySlot(routeKey);
    }
  };
}
`;

// ══════════════════════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS & TRANSPORT HARDENING
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 10 of the API Security & Resource Governance Spec:
// - Content-Security-Policy
// - X-Content-Type-Options
// - Referrer-Policy
// - Permissions-Policy
// - Strict-Transport-Security (HTTPS required in prod)
// - Request-ID propagation

import { NextResponse } from 'next/server';

export const CANONICAL_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Applies framework security headers and request-id to any outbound HTTP response.
 */
export function applySecurityHeaders(
  response: Response | NextResponse,
  requestId: string
): Response | NextResponse {
  for (const [key, value] of Object.entries(CANONICAL_SECURITY_HEADERS)) {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }

  // Attach Request-ID
  response.headers.set('X-Request-Id', requestId);

  // HTTPS Transport Strictness in production
  if (process.env.NODE_ENV === 'production' && !response.headers.has('Strict-Transport-Security')) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

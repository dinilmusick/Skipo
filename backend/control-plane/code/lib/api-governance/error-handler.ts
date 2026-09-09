// ══════════════════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING & STACK ISOLATION
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 11 of the API Security & Resource Governance Spec:
// - INTERNAL_ERROR: CLIENT_RESPONSE != INTERNAL_STACK_TRACE
// - Client: generic sanitized error + request_id
// - Server: full error + request_id + route + timestamp

import { NextResponse } from 'next/server';
import { applySecurityHeaders } from './security-headers';

/**
 * Catches unhandled application errors, logs complete server diagnostic trace,
 * and returns a sanitized client response with zero internal leak.
 */
export function handleSecureApiError(
  error: any,
  requestId: string,
  routeId: string
): NextResponse {
  const timestamp = new Date().toISOString();
  const errorMessage = error?.message || 'Unknown Server Error';
  const errorStack = error?.stack || 'No stack trace available';

  // Server-side audit log
  console.error(`[API INTERNAL ERROR] [${timestamp}] [ReqID: ${requestId}] [Route: ${routeId}]`);
  console.error(`Error: ${errorMessage}`);
  console.error(errorStack);

  const responsePayload = {
    success: false,
    error: 'INTERNAL_ERROR',
    requestId,
    message: 'An unexpected internal error occurred. Please contact support with the requestId.',
    // Only expose error snippet in development mode for easier debugging
    ...(process.env.NODE_ENV !== 'production' ? { debugDetail: errorMessage } : {}),
  };

  const response = NextResponse.json(responsePayload, { status: 500 });
  return applySecurityHeaders(response, requestId) as NextResponse;
}

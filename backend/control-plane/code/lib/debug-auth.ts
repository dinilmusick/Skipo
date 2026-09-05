import { NextRequest } from 'next/server';

/**
 * Validates request authorization for debug endpoints.
 * Requires authorization if DEBUG_AUTH_TOKEN or ADMIN_DEBUG_SECRET is configured.
 */
export function authorizeDebugRequest(req: NextRequest): { authorized: boolean; error?: string } {
  const expectedToken = process.env.DEBUG_AUTH_TOKEN || process.env.ADMIN_DEBUG_SECRET;

  // If no debug secret configured on server, allow access (e.g. local dev / test runner)
  if (!expectedToken) {
    return { authorized: true };
  }

  const headerToken =
    req.headers.get('x-debug-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!headerToken || headerToken !== expectedToken) {
    return {
      authorized: false,
      error: 'UNAUTHORIZED_DEBUG_ACCESS: Valid x-debug-token or Bearer token is required.',
    };
  }

  return { authorized: true };
}

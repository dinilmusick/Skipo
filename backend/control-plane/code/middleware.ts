import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SECURITY_HEADERS } from './lib/api-governance/security-headers';
import { isIpBlocked } from './lib/api-governance/abuse-detector';

// Suspicious bot scanner patterns to drop immediately with zero computation
const SUSPICIOUS_PATH_PATTERNS = [
  /\.php$/i,
  /\/wp-admin/i,
  /\/wp-includes/i,
  /\/wp-content/i,
  /\/xmlrpc/i,
  /\.env/i,
  /\/\.git/i,
  /\/cgi-bin/i,
  /\/actuator/i,
  /\/setup\.cgi/i,
  /\/phpmyadmin/i,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Drop known vulnerability scanners immediately at edge
  for (const pattern of SUSPICIOUS_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  // 2. Extract Client IP
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';

  // 3. Early Edge IP Blocklist Check (Only for protected API routes, never block UI pages or auth endpoints)
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    const blockCheck = isIpBlocked(ip);
    if (blockCheck.blocked) {
      return new NextResponse('Access Denied: Anomalous Bot Activity Detected.', {
        status: 403,
        headers: { 'Retry-After': String(blockCheck.retryAfterSec || 900) },
      });
    }
  }

  // 4. Generate Request ID
  const existingRequestId = req.headers.get('x-request-id');
  const requestId = existingRequestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 5. Clone request headers with injected Request ID
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  // 6. Proceed to route handler
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 7. Inject Security Headers and Request ID into Outbound Response
  for (const [key, value] of Object.entries(CANONICAL_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

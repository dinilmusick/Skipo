/**
 * @fileoverview Next.js Edge Middleware Template
 */

export const governanceMiddlewareTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { isIpBlocked } from './src/lib/api-governance/abuse-detector';
import { SECURITY_HEADERS } from './src/lib/api-governance/security-headers';

const SCANNER_EXTENSIONS = ['.php', '.asp', '.aspx', '.jsp', '.cgi', '.env', '.git'];
const SCANNER_PATHS = ['/wp-admin', '/wp-login', '/cgi-bin', '/solr', '/xmlrpc.php', '/actuator'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.toLowerCase();
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';

  if (isIpBlocked(ip)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (SCANNER_PATHS.some((p) => path.startsWith(p)) || SCANNER_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
`;

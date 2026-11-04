import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

const PUBLIC_PATHS = new Set(['/api/health', '/api/public/routes']);

function isLuthAuthEndpoint(pathname: string): boolean {
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return !pathname.startsWith('/api/auth/workspaces')
      && !pathname.startsWith('/api/auth/storage/');
  }
  return false;
}

/** Verify every application API request against Luth before trusting identity headers. */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method === 'OPTIONS' || PUBLIC_PATHS.has(pathname) || isLuthAuthEndpoint(pathname)) {
    return NextResponse.next();
  }

  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (!authorization && !cookie) {
    return NextResponse.json({ error: 'A verified Luth session is required.' }, { status: 401 });
  }

  try {
    const headers = new Headers({ 'x-app-id': request.nextUrl.host });
    if (authorization) headers.set('authorization', authorization);
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`${DEFAULT_LUTH_URL}/api/session`, {
      headers,
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Luth session is invalid or expired.' }, { status: 401 });
    }

    const session = await response.json() as {
      authenticated?: boolean;
      user?: { id?: string; email?: string; name?: string };
    };
    if (!session.authenticated || !session.user?.id) {
      return NextResponse.json({ error: 'Luth session is invalid or expired.' }, { status: 401 });
    }

    const forwarded = new Headers(request.headers);
    forwarded.set('x-user-id', session.user.id);
    if (session.user.email) forwarded.set('x-user-email', session.user.email);
    forwarded.set('x-user-role', 'user');
    return NextResponse.next({ request: { headers: forwarded } });
  } catch {
    return NextResponse.json(
      { error: 'Canonical Luth authentication service unavailable.' },
      { status: 503 },
    );
  }
}

export const config = {
  matcher: ['/api/:path*'],
};

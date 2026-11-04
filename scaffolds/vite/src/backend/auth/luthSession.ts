import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

const APP_ID = 'skipo-app';
const APP_AUTH_PATHS = [
  '/api/auth/workspaces',
  '/api/auth/storage/',
];

function isAppOwnedAuthPath(pathname: string): boolean {
  return APP_AUTH_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export async function proxyLuthAuthRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/auth/') || isAppOwnedAuthPath(url.pathname)) return null;
  if (url.pathname === '/api/auth/admin/login') {
    return Response.json({ success: false, error: 'Administrative login is not provided by Luth user authentication.' }, { status: 403 });
  }

  const targetPath = url.pathname === '/api/auth/login'
    ? '/api/auth/sign-in/email'
    : url.pathname === '/api/auth/register'
      ? '/api/auth/sign-up/email'
      : url.pathname;
  const headers = new Headers();
  for (const name of ['authorization', 'cookie', 'content-type', 'origin', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-app-id', APP_ID);

  try {
    const upstream = await fetch(`${DEFAULT_LUTH_URL}${targetPath}${url.search}`, {
      method: request.method,
      headers,
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: await request.arrayBuffer() }),
      redirect: 'manual',
      cache: 'no-store',
    });
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'set-cookie', 'set-auth-token', 'location', 'cache-control']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ success: false, error: 'Canonical Luth authentication service unavailable.' }, { status: 503 });
  }
}

export async function authenticateLuthRequest(request: Request): Promise<{
  request?: Request;
  status?: number;
  error?: string;
}> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (
    request.method === 'OPTIONS' ||
    pathname === '/health' ||
    pathname === '/api/health' ||
    pathname === '/api/public/routes' ||
    pathname.startsWith('/api/public/routes/')
  ) return { request };

  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (!authorization && !cookie) return { status: 401, error: 'A verified Luth session is required.' };

  try {
    const headers = new Headers({ 'x-app-id': APP_ID });
    if (authorization) headers.set('authorization', authorization);
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`${DEFAULT_LUTH_URL}/api/session`, {
      headers,
      cache: 'no-store',
    });
    if (!response.ok) return { status: 401, error: 'Luth session is invalid or expired.' };
    const session = await response.json() as {
      authenticated?: boolean;
      user?: { id?: string; email?: string; name?: string };
    };
    if (!session.authenticated || !session.user?.id) {
      return { status: 401, error: 'Luth session is invalid or expired.' };
    }

    const forwarded = new Headers(request.headers);
    forwarded.set('x-user-id', session.user.id);
    if (session.user.email) forwarded.set('x-user-email', session.user.email);
    forwarded.set('x-user-role', 'user');
    return { request: new Request(request, { headers: forwarded }) };
  } catch {
    return { status: 503, error: 'Canonical Luth authentication service unavailable.' };
  }
}

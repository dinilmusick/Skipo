import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';
import { SKIPO_APPLICATION_ID } from '../../libraries/client/luthAuthClient.js';
/** App-origin sessions are verified by the Kloks BFF.
 * Legacy cross-domain cookie proxying is intentionally not exposed. */

/** Verify the canonical Luth session for external HTTP and MCP transports. */
export async function getLuthSession(request: Request) {
  const headers = new Headers({
    // Binding is compiled into the generated app, never caller-supplied.
    'x-app-id': SKIPO_APPLICATION_ID,
  });
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return null;
  headers.set('authorization', bearer);
  try {
    const response = await fetch(`${DEFAULT_LUTH_URL}/api/session`, {
      method: 'GET', headers, cache: 'no-store', redirect: 'manual',
    });
    if (!response.ok) return null;
    const session = await response.json().catch(() => null) as any;
    if (session?.authenticated !== true || typeof session?.user?.id !== 'string' ||
        typeof session?.session?.id !== 'string') return null;
    return session;
  } catch {
    return null;
  }
}

export async function authenticateLuthRequest(request: Request): Promise<{
  request?: Request;
  status?: number;
  error?: string;
}> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return { request };
  if (
    request.method === 'OPTIONS' ||
    pathname === '/health' ||
    pathname === '/api/health' ||
    pathname === '/api/public/routes' ||
    pathname.startsWith('/api/public/routes/')
  ) return { request };

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return { status: 401, error: 'An explicit verified Luth bearer is required for API clients.' };
  }

  try {
    const headers = new Headers({ 'x-app-id': SKIPO_APPLICATION_ID });
    headers.set('authorization', authorization);
    const response = await fetch(`${DEFAULT_LUTH_URL}/api/session`, {
      headers,
      cache: 'no-store',
    });
    if (!response.ok) return { status: 401, error: 'Luth session is invalid or expired.' };
    const session = await response.json() as {
      authenticated?: boolean;
      user?: { id?: string; email?: string; name?: string };
      session?: { id?: string };
    };
    if (session.authenticated !== true || !session.user?.id || !session.session?.id) {
      return { status: 401, error: 'Luth session is invalid or expired.' };
    }

    const forwarded = new Headers(request.headers);
    // Caller-supplied identity metadata cannot survive principal admission.
    for (const key of ['x-user-id', 'x-user-email', 'x-user-role', 'x-session-id']) forwarded.delete(key);
    forwarded.set('x-user-id', session.user.id);
    if (session.user.email) forwarded.set('x-user-email', session.user.email);
    if (session.session?.id) forwarded.set('x-session-id', session.session.id);
    forwarded.set('x-user-role', 'user');
    return { request: new Request(request, { headers: forwarded }) };
  } catch {
    return { status: 503, error: 'Canonical Luth authentication service unavailable.' };
  }
}

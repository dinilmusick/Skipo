import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

export interface VerifiedLuthSession {
  authenticated: true;
  user: { id: string; [key: string]: unknown };
  session: { id: string; expiresAt?: string; [key: string]: unknown };
}

/** Delegate request authentication to Luth; never trust an app-supplied user ID. */
export async function getLuthSession(request: Request): Promise<VerifiedLuthSession | null> {
  const headers = new Headers({ 'x-app-id': request.headers.get('x-app-id') || new URL(request.url).hostname });
  for (const name of ['authorization', 'cookie', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(`${DEFAULT_LUTH_URL}/api/session`, {
      method: 'GET', headers, cache: 'no-store', redirect: 'manual',
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as Record<string, any> | null;
  if (payload?.authenticated !== true ||
      typeof payload?.user?.id !== 'string' ||
      typeof payload?.session?.id !== 'string') return null;
  return payload as VerifiedLuthSession;
}

export async function requireLuthSession(request: Request): Promise<VerifiedLuthSession> {
  const session = await getLuthSession(request);
  if (session) return session;
  throw new Response(JSON.stringify({ error: 'Unauthenticated' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

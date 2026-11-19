import { createCanonicalApplicationOAuthBff } from '@ultrst-armada/kloks/backend/auth';
import { SKIPO_APPLICATION_ID } from '../../libraries/client/luthAuthClient.js';

/**
 * Generated application adapter. All Better Auth, PKCE, callback, session
 * creation and validation logic remains exclusively in Kloks.
 */
function bff(request: Request, env: Record<string, unknown>) {
  return createCanonicalApplicationOAuthBff(request, env, SKIPO_APPLICATION_ID);
}

export async function handleApplicationOAuth(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response | null> {
  if (!new URL(request.url).pathname.startsWith('/api/auth/oidc/')) return null;
  try {
    return await bff(request, env).handle(request);
  } catch {
    return Response.json({ error: 'CANONICAL_APPLICATION_OAUTH_UNAVAILABLE' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  }
}

export async function verifyApplicationOAuthSession(
  request: Request,
  env: Record<string, unknown>,
): Promise<{ userId: string; sessionId: string } | null> {
  const session = await bff(request, env).getSession(request);
  return session ? { userId: session.user.id, sessionId: session.session.id } : null;
}

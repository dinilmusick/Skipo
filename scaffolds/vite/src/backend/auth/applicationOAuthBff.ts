import { createOAuthBff, type OAuthBffConfig } from '@ultrst-armada/kloks/backend/auth';
import { neon } from '@neondatabase/serverless';
import { DEFAULT_LUTH_URL } from '@dinilmusick/gutts/auth';
import { SKIPO_APPLICATION_ID } from '../../libraries/client/luthAuthClient.js';

/**
 * This is deployment configuration only. All callback, PKCE, OAuth and session
 * behavior is implemented once in Kloks; generated apps must not reimplement
 * or proxy Better Auth's session cookies across incompatible domains.
 *
 * A trusted operator provisions the verified Luth OAuth client first.
 * An unprovisioned app fails closed instead of registering an arbitrary origin.
 */
function configuredBff(request: Request, env: Record<string, unknown>) {
  const appUrl = String(env.APP_URL || '').trim();
  const clientId = String(env.LUTH_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(env.LUTH_OAUTH_CLIENT_SECRET || '').trim();
  const sessionSecret = String(env.LUTH_OAUTH_BFF_SECRET || '').trim();
  const databaseUrl = String(env.SYSTEM_DATABASE_URL || env.SYSTEM_DATABASE_URL_2 || env.SYSTEM_DATABASE_URL_3 || '');
  if (!appUrl || !clientId || !clientSecret || sessionSecret.length < 32 || !databaseUrl) {
    throw new Error('CANONICAL_APPLICATION_OAUTH_NOT_PROVISIONED');
  }
  const origin = new URL(appUrl).origin;
  if (new URL(request.url).origin !== origin) throw new Error('APPLICATION_ORIGIN_MISMATCH');
  const issuer = DEFAULT_LUTH_URL.replace(/\/$/, '') + '/api/auth';
  const sql = neon(databaseUrl);
  const config: OAuthBffConfig = {
    appId: SKIPO_APPLICATION_ID,
    clientId, clientSecret, issuer,
    redirectUri: origin + '/api/auth/oidc/callback',
    encryptionSecret: sessionSecret,
    database: {
      async query(statement, values) {
        const result = await sql.query(statement, [...values]);
        return { rows: [...result] };
      },
    },
  };
  return createOAuthBff(config);
}

export async function handleApplicationOAuth(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response | null> {
  if (!new URL(request.url).pathname.startsWith('/api/auth/oidc/')) return null;
  try {
    return await configuredBff(request, env).handle(request);
  } catch {
    return Response.json({ error: 'CANONICAL_APPLICATION_OAUTH_UNAVAILABLE' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  }
}

/**
 * Authenticates all other app APIs against the Kloks BFF; returns a verified
 * principal, not a user ID supplied in a request header or body.
 */
export async function verifyApplicationOAuthSession(
  request: Request,
  env: Record<string, unknown>,
): Promise<{ userId: string; sessionId: string } | null> {
  const session = await configuredBff(request, env).getSession(request);
  if (!session) return null;
  return { userId: session.user.id, sessionId: session.session.id };
}

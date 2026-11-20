import { createCanonicalApplicationOAuthBff } from '@ultrst-armada/kloks/backend/auth';

/**
 * The canonical application-owned OAuth BFF is the only authorization holder.
 * Browser JavaScript never obtains OAuth bearer or confidential client secrets.
 */
export async function handleSkipoUniversalBff(
  request: Request, env: Record<string, unknown>,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/api/initialization/config' &&
      !pathname.startsWith('/api/auth/oidc/')) return null;
  try {
    // Canonical ID belongs to the app, never hostname or caller header.
    const bff = createCanonicalApplicationOAuthBff(request, env, 'my-app');
    const response = await bff.handle(request);
    if (!response) return Response.json(
      { error: 'CANONICAL_AUTH_PATH_NOT_SUPPORTED' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
    return response;
  } catch {
    return Response.json({ error: 'CANONICAL_APP_AUTH_NOT_PROVISIONED' },
      { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

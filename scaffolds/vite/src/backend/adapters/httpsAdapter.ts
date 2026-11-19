import { ecosystem } from '../ecosystem/AppEcosystem_Impure.js';
import { handleUiSessionRequest } from '@ultrst-armada/kloks/backend/ui-session';
import { authenticateLuthRequest } from '../auth/luthSession.js';
import { handleApplicationOAuth, verifyApplicationOAuthSession } from '../auth/applicationOAuthBff.js';
import { fetch as universalFetch } from '../../app.js';
import {
  listWorkspaces, createWorkspace, invokeStorage, completeGoogleDriveOAuth,
} from '../storage/canonicalCapabilityRoutes.js';

export interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
});

function oauthNonceCookie(nonce: string, origin: string, clear = false): string {
  return 'skipo_google_drive_nonce=' + (clear ? '' : encodeURIComponent(nonce))
    + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (clear ? 0 : 600)
    + (origin.startsWith('https:') ? '; Secure' : '');
}


export async function fetchHandler(request: Request, env: Env = {}): Promise<Response> {
  // OAuth callbacks must reach the canonical Kloks BFF before any application
  // middleware or general capability handler can require an existing session.
  if (new URL(request.url).pathname.startsWith('/api/auth/oidc/')) {
    const response = await handleApplicationOAuth(request, env);
    if (response) return response;
  }
  await ecosystem.observe(env);
  const invocation = await ecosystem.handle(request, env);
  if (invocation) return invocation;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/auth(?=\/)/, '/api');

  if (path === '/api/health' || path === '/health') return json({ status: 'ok', service: 'skipo-application' });

  // Application capability endpoints must not be consumed by generic external interfaces.
  const capabilityRequest = path === '/api/workspaces' || path === '/api/workspace' ||
    path.startsWith('/api/storage/') || path.startsWith('/api/ui-session/');
  if (!capabilityRequest) {
    const sharedResponse = await universalFetch(request, env);
    if (sharedResponse.status !== 404) return sharedResponse;
  }

  // The canonical app-owned BFF verifies its own first-party opaque cookie
  // against Luth. No browser-supplied x-user-id or workspace claim is trusted.
  // Legacy bearer calls remain supported for API-only consumers until migrated.
  // Authentication is selected by *credential type*, not by whether a
  // particular provider is provisioned. Missing credentials are 401, while
  // a real first-party BFF cookie with unavailable verification is 503.
  // Never forward an application-origin cookie to the Luth domain.
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(x => x.trim());
  const hasBffSession = cookies.some(x =>
    x.startsWith('__Host-ultrst_oidc_session=') || x.startsWith('ultrst_oidc_session='));
  const bearer = request.headers.get('authorization');
  if (!hasBffSession && !bearer?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Verified Luth identity required.' }, 401);
  }
  if (hasBffSession) {
    let principal: { userId: string; sessionId: string } | null;
    try {
      principal = await verifyApplicationOAuthSession(request, env);
    } catch {
      return json({ success: false, error: 'Canonical application session verification unavailable.' }, 503);
    }
    if (!principal) return json({ success: false, error: 'Application session invalid or revoked.' }, 401);
    const verified = new Headers(request.headers);
    for (const name of ['x-user-id', 'x-user-email', 'x-session-id', 'x-user-role']) verified.delete(name);
    verified.set('x-user-id', principal.userId);
    verified.set('x-session-id', principal.sessionId);
    verified.set('x-user-role', 'user');
    request = new Request(request, { headers: verified });
  } else {
    // Explicit API bearers continue to use Luth's canonical server-side
    // validation without any cookie proxy, token issuance, or fallback.
    const auth = await authenticateLuthRequest(request);
    if (auth.status) return json({ success: false, error: auth.error || 'Authentication required.' }, auth.status);
    request = auth.request || request;
  }
  const userId = request.headers.get('x-user-id');
  const uiSession = await handleUiSessionRequest(request, { appId: 'skipo', principalId: userId || '', env });
  if (uiSession) return uiSession;
  if (!userId) return json({ success: false, error: 'Verified Luth identity required.' }, 401);

  try {
    if (path === '/api/workspaces' || path === '/api/workspace') {
      if (request.method === 'GET') return json(await listWorkspaces(userId, env));
      if (request.method === 'POST') return json(await createWorkspace(userId, await request.json(), env), 201);
    }

    if (path === '/api/storage/connections') {
      if (request.method === 'GET') {
        return json({ success: true, connections: await invokeStorage(userId, 'getConnections', {}, env) });
      }
      if (request.method === 'POST') {
        const input = await request.json() as Record<string, unknown>;
        if (input.provider !== 'backblaze_b2') return json({ success: false, error: 'Unsupported connection operation.' }, 422);
        return json(await invokeStorage(userId, 'createBackblazeConnection', input, env), 201);
      }
    }

    if (path === '/api/storage/test' && request.method === 'POST') {
      const input = await request.json() as Record<string, unknown>;
      return json(await invokeStorage(userId, input.provider === 'google_drive' ? 'testGoogleDriveConnection' : 'testBackblazeCredentials', input, env));
    }

    if (path === '/api/storage/google-drive/callback' && request.method === 'GET') {
      const nonceCookie = request.headers.get('cookie')?.match(/(?:^|;\s*)skipo_google_drive_nonce=([^;]*)/)?.[1] || '';
      const value = await completeGoogleDriveOAuth(
        userId, url.searchParams.get('state') || '', decodeURIComponent(nonceCookie),
        url.searchParams.get('code') || '', url.origin, env,
      );
      const destination = new URL(value.returnTo);
      destination.searchParams.set('googleDriveConnected', '1');
      destination.searchParams.set('googleDriveConnectionId', value.connectionId);
      return new Response(null, { status: 303, headers: {
        location: destination.toString(), 'set-cookie': oauthNonceCookie('', url.origin, true), ...cors,
      } });
    }

    if (path === '/api/storage/invoke' && request.method === 'POST') {
      const body = await request.json() as { operation?: string; input?: Record<string, unknown> };
      if (body.operation === 'createGoogleDriveAuthorizationRequest') {
        const origin = new URL(request.url).origin;
        if (body.input?.callbackOrigin !== origin ||
            typeof body.input?.returnTo !== 'string' ||
            new URL(body.input.returnTo, origin).origin !== origin) {
          return json({ success: false, error: 'OAuth callback origin mismatch.' }, 400);
        }
      }
      const result = await invokeStorage(userId, body.operation || '', body.input, env);
      if (body.operation === 'createGoogleDriveAuthorizationRequest') {
        const value = result as { authorizationUrl?: string; nonce?: string; expiresAt?: string };
        if (typeof value?.authorizationUrl !== 'string' || !/^[A-Za-z0-9_-]{20,}$/.test(value.nonce || '')) {
          throw new Error('Kloks did not provide a valid OAuth authorization and nonce.');
        }
        const response = json({ authorizationUrl: value.authorizationUrl, expiresAt: value.expiresAt });
        response.headers.set('set-cookie', oauthNonceCookie(value.nonce!, url.origin));
        return response;
      }
      return json(result);
    }
  } catch (cause) {
    return json({ success: false, error: cause instanceof Error ? cause.message : 'Canonical service failed.' }, 400);
  }
  return json({ error: 'Not Found', path: url.pathname }, 404);
}

export default { fetch: fetchHandler };

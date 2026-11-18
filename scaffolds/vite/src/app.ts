import { ecosystem } from './backend/ecosystem/AppEcosystem_Impure.js';
import { externalInterfaces } from './backend/UniversalBackend.js';
import { proxyLuthAuthRequest, authenticateLuthRequest } from './backend/auth/luthSession.js';
import { handleUiSessionRequest } from '@ultrst-armada/kloks/backend/ui-session';
import {
  listWorkspaces, createWorkspace, invokeStorage, completeGoogleDriveOAuth,
} from './backend/storage/canonicalCapabilityRoutes.js';

/**
 * Canonical Web-standard application entrypoint.
 * Node, Cloudflare and Vercel adapters all delegate here. Application routes,
 * authentication, MCP/HTTP capabilities and static assets share this pipeline.
 */
export interface SkipoEnv {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
});

function oauthNonceCookie(nonce: string, origin: string, clear = false): string {
  return 'skipo_google_drive_nonce=' + (clear ? '' : encodeURIComponent(nonce))
    + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (clear ? 0 : 600)
    + (origin.startsWith('https:') ? '; Secure' : '');
}

async function fetchStaticAsset(
  request: Request,
  assets: SkipoEnv['ASSETS'],
): Promise<Response | null> {
  if (!assets || (request.method !== 'GET' && request.method !== 'HEAD')) return null;
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/api/') || pathname === '/mcp') return null;

  const candidates: string[] = [];
  if (pathname === '/') {
    candidates.push('/index.html');
  } else if (!pathname.includes('.')) {
    const cleanPath = pathname.replace(/\/$/, '');
    candidates.push(cleanPath + '.html', cleanPath + '/index.html', pathname, '/index.html');
  } else {
    candidates.push(pathname);
  }

  for (const candidate of candidates) {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = candidate;
    const response = await assets.fetch(new Request(assetUrl, request));
    if (response.status !== 404) return response;
  }
  return null;
}

export async function fetch(
  request: Request,
  env: SkipoEnv = {},
  _ctx?: unknown,
): Promise<Response> {
  await ecosystem.observe(env);
  const invocation = await ecosystem.handle(request, env);
  if (invocation) return invocation;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/auth(?=\/)/, '/api');

  if (path === '/api/health' || path === '/health') {
    return json({ status: 'ok', service: 'skipo-application' });
  }

  // Workspace, storage and UI-session routes are app-owned capabilities. All
  // other paths continue through the shared auth proxy, MCP and HTTP handlers.
  const capabilityRequest = path === '/api/workspaces' || path === '/api/workspace' ||
    path.startsWith('/api/storage/') || path.startsWith('/api/ui-session/');

  if (!capabilityRequest) {
    const assetResponse = await fetchStaticAsset(request, env.ASSETS);
    if (assetResponse) return assetResponse;

    const authProxy = await proxyLuthAuthRequest(request);
    if (authProxy) return authProxy;

    const mcp = await externalInterfaces.mcp(request);
    if (mcp) return mcp;

    const http = await externalInterfaces.http(request);
    if (http) return http;

    // Preserve the legacy adapter's fail-closed fallback for unhandled app
    // routes: route handlers get first refusal, but unknown application paths
    // still require a verified Luth principal before revealing a 404.
    const auth = await authenticateLuthRequest(request);
    if (auth.status) return json({ success: false, error: auth.error || 'Authentication required.' }, auth.status);
    request = auth.request || request;

    const userId = request.headers.get('x-user-id');
    const uiSession = await handleUiSessionRequest(request, {
      appId: 'skipo',
      principalId: userId || '',
      env,
    });
    if (uiSession) return uiSession;
    if (!userId) return json({ success: false, error: 'Verified Luth identity required.' }, 401);

    return json({ error: 'Not Found' }, 404);
  }

  const auth = await authenticateLuthRequest(request);
  if (auth.status) return json({ success: false, error: auth.error || 'Authentication required.' }, auth.status);
  request = auth.request || request;

  const userId = request.headers.get('x-user-id');
  const uiSession = await handleUiSessionRequest(request, {
    appId: 'skipo',
    principalId: userId || '',
    env,
  });
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
        if (input.provider !== 'backblaze_b2') {
          return json({ success: false, error: 'Unsupported connection operation.' }, 422);
        }
        return json(await invokeStorage(userId, 'createBackblazeConnection', input, env), 201);
      }
    }

    if (path === '/api/storage/test' && request.method === 'POST') {
      const input = await request.json() as Record<string, unknown>;
      return json(await invokeStorage(
        userId,
        input.provider === 'google_drive' ? 'testGoogleDriveConnection' : 'testBackblazeCredentials',
        input,
        env,
      ));
    }

    if (path === '/api/storage/google-drive/callback' && request.method === 'GET') {
      const nonceCookie = request.headers.get('cookie')?.match(/(?:^|;\s*)skipo_google_drive_nonce=([^;]*)/)?.[1] || '';
      const value = await completeGoogleDriveOAuth(
        userId,
        url.searchParams.get('state') || '',
        decodeURIComponent(nonceCookie),
        url.searchParams.get('code') || '',
        url.origin,
        env,
      );
      const destination = new URL(value.returnTo);
      destination.searchParams.set('googleDriveConnected', '1');
      destination.searchParams.set('googleDriveConnectionId', value.connectionId);
      return new Response(null, {
        status: 303,
        headers: {
          location: destination.toString(),
          'set-cookie': oauthNonceCookie('', url.origin, true),
          ...cors,
        },
      });
    }

    if (path === '/api/storage/invoke' && request.method === 'POST') {
      const body = await request.json() as {
        operation?: string;
        input?: Record<string, unknown>;
      };
      if (body.operation === 'createGoogleDriveAuthorizationRequest') {
        const origin = url.origin;
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

export default { fetch };

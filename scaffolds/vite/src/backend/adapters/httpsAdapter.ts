import { authenticateLuthRequest } from '../auth/luthSession.js';
import { fetch as universalFetch } from '../../app.js';
import {
  listWorkspaces, createWorkspace, invokeStorage,
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

export async function fetchHandler(request: Request, env: Env = {}): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/auth(?=\/)/, '/api');

  if (env.ASSETS && typeof env.ASSETS.fetch === 'function' &&
      !url.pathname.startsWith('/api/') && url.pathname !== '/health' && url.pathname !== '/mcp') {
    return env.ASSETS.fetch(request);
  }
  if (path === '/api/health' || path === '/health') return json({ status: 'ok', service: 'skipo-application' });

  const sharedResponse = await universalFetch(request, env);
  if (sharedResponse.status !== 404) return sharedResponse;

  const auth = await authenticateLuthRequest(request);
  if (auth.status) return json({ success: false, error: auth.error || 'Authentication required.' }, auth.status);
  request = auth.request || request;
  const userId = request.headers.get('x-user-id');
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
      return json(await invokeStorage(userId, body.operation || '', body.input, env));
    }
  } catch (cause) {
    return json({ success: false, error: cause instanceof Error ? cause.message : 'Canonical service failed.' }, 400);
  }
  return json({ error: 'Not Found', path: url.pathname }, 404);
}

export default { fetch: fetchHandler };

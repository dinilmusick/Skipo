// ══════════════════════════════════════════════════════════════════════════════
// PROTOCOL ADAPTER: HTTPS / CLOUDFLARE WORKERS FETCH ADAPTER
// Spec: MULTI_TARGET_BUILD_SPEC §2 Protocol Adapter Invariant (Law L8, Law L23)
// ══════════════════════════════════════════════════════════════════════════════

import { appBackend } from '../AppBackend';

export interface Env {
  ENVIRONMENT?: string;
  APP_NAME?: string;
  SYSTEM_DATABASE_URL_1?: string;
  DATABASE_URL?: string;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  [key: string]: unknown;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check endpoint
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'my-app-worker',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Auth routes
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const res = await appBackend.services.auth.loginUser(body.email, body.password, body.isAdmin, env);
        return jsonResponse(res, res.status || (res.success ? 200 : 401));
      }

      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const res = await appBackend.services.auth.registerUser(body, env);
        return jsonResponse(res, res.status || (res.success ? 201 : 400));
      }

      // Workspaces & Storage routes
      if (url.pathname === '/api/auth/workspaces' || url.pathname === '/api/workspace') {
        const userId = request.headers.get('x-user-id') || url.searchParams.get('userId') || undefined;
        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const res = await appBackend.services.workspace.createWorkspace(userId || 'default', body, env);
          return jsonResponse(res, 201);
        }
        const res = await appBackend.services.workspace.getWorkspaces(userId, env);
        return jsonResponse(res);
      }

      if (url.pathname === '/api/auth/storage/connections') {
        const userId = request.headers.get('x-user-id') || undefined;
        if (request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          const res = await appBackend.services.storage.saveStorageConnection(userId || 'default', body, env);
          return jsonResponse(res);
        }
        const res = await appBackend.services.storage.getStorageConnections(userId, env);
        return jsonResponse(res);
      }

      if (url.pathname === '/api/auth/storage/test' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const res = await appBackend.services.storage.testStorageConnection(body);
        return jsonResponse(res);
      }

      // Non-API routes: Delegate to Cloudflare Worker Static Assets
      if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return await env.ASSETS.fetch(request);
      }

      return jsonResponse({ error: 'Not Found', path: url.pathname }, 404);
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Internal Server Error' }, 500);
    }
  },
};

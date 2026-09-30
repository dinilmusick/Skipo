// ══════════════════════════════════════════════════════════════════════════════
// PROTOCOL ADAPTER: UNIVERSAL HTTPS / FETCH ADAPTER (CLOUDFLARE & VERCEL)
// Spec: MULTI_TARGET_BUILD_SPEC §2 Protocol Adapter Invariant & Law L8, Law L23
// Zero divergence across Cloudflare Workers, Vercel Serverless, and Local Dev (<200 lines).
// ══════════════════════════════════════════════════════════════════════════════

import { appBackend } from '../AppBackend';
import { adaptNodeRequest } from './nodeBridge';
import { handleVaultRoutes } from './vaultRoutes';

export interface Env {
  ENVIRONMENT?: string;
  APP_NAME?: string;
  SYSTEM_DATABASE_URL_1?: string;
  DATABASE_URL?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Workspace-Id, X-Vault-Key',
};

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

async function parseBody(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

function getUserId(req: Request, url: URL): string {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer sess::')) {
    const p = auth.replace('Bearer sess::', '').split('::');
    if (p[0]) return p[0];
  }
  return req.headers.get('x-user-id') || url.searchParams.get('userId') || '';
}

export async function fetchHandler(request: Request, env: Env = {}): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (pathname === '/api/health' || pathname === '/health') {
      return jsonRes({ status: 'ok', service: env.APP_NAME || 'skipo-app', timestamp: new Date().toISOString() });
    }

    // 1. Auth routes
    if (pathname === '/api/auth/login' && method === 'POST') {
      const b = await parseBody(request);
      const res = await appBackend.services.auth.loginUser(b.email || b.identifier, b.password, false, env);
      return jsonRes(res, res.status);
    }
    if (pathname === '/api/auth/admin/login' && method === 'POST') {
      const b = await parseBody(request);
      const res = await appBackend.services.auth.loginUser(b.email || b.identifier, b.password, true, env);
      return jsonRes(res, res.status);
    }
    if (pathname === '/api/auth/users' && method === 'GET') {
      return jsonRes(await appBackend.services.auth.getUsers(env));
    }

    // 2. Workspace & Cloud Storage routes
    if (pathname === '/api/workspaces' || pathname === '/api/auth/workspaces') {
      const uId = getUserId(request, url);
      if (method === 'GET') return jsonRes(await appBackend.services.workspace.getWorkspaces(uId, env));
      if (method === 'POST') {
        const b = await parseBody(request);
        return jsonRes(await appBackend.services.workspace.createWorkspace(uId || b.userId, b.workspace || b, env));
      }
      if (method === 'PUT') {
        const b = await parseBody(request);
        return jsonRes(await appBackend.services.workspace.updateWorkspace(uId || b.userId, b, env));
      }
      if (method === 'DELETE') {
        const wsId = url.searchParams.get('workspaceId') || url.searchParams.get('id') || '';
        return jsonRes(await appBackend.services.workspace.deleteWorkspace(uId, wsId, env));
      }
    }

    // 3. Storage connections
    if (pathname === '/api/storage/connections') {
      const uId = getUserId(request, url);
      if (method === 'GET') return jsonRes(await appBackend.services.storage.getStorageConnections(uId, env));
      if (method === 'POST') {
        const b = await parseBody(request);
        return jsonRes(await appBackend.services.storage.saveStorageConnection(uId || b.userId, b.connection || b, env), 201);
      }
    }
    if (pathname === '/api/storage/test' && method === 'POST') {
      const b = await parseBody(request);
      return jsonRes(await appBackend.services.storage.testStorageConnection(b.connection || b));
    }

    // 4. Workspace Vault & SRKL Ecosystem routes
    const vaultRes = await handleVaultRoutes(request, url, getUserId(request, url), env, jsonRes, parseBody);
    if (vaultRes) return vaultRes;

    // Non-API routes: delegate to Cloudflare Worker Static Assets (env.ASSETS) or 404
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function' && !pathname.startsWith('/api/')) {
      return await env.ASSETS.fetch(request);
    }

    return jsonRes({ error: 'Not Found', path: pathname }, 404);
  } catch (err: any) {
    return jsonRes({ error: err.message || 'Internal Server Error' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env = {}, ctx?: any): Promise<Response> {
    return fetchHandler(request, env);
  },
};

export { adaptNodeRequest };

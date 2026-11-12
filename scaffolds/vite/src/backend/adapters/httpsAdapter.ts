import { authenticateLuthRequest } from '../auth/luthSession.js';
import { fetch as universalFetch } from '../../app.js';
import { AppBackend } from '../AppBackend.js';

export interface Env { ASSETS?: { fetch: (request: Request) => Promise<Response> }; [key: string]: unknown; }
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...cors } });

export async function fetchHandler(request: Request, env: Env = {}): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const sharedResponse = await universalFetch(request, env);
  if (sharedResponse.status !== 404) return sharedResponse;
  const auth = await authenticateLuthRequest(request);
  if (auth.status) return json({ error: auth.error || 'Authentication required.' }, auth.status);
  request = auth.request || request;
  const url = new URL(request.url);
  if (url.pathname === '/api/health' || url.pathname === '/health') return json({ status: 'ok', service: 'skipo-application' });
  if (url.pathname === '/api/workspaces' && request.method === 'GET') {
    const service = AppBackend.services.workspace as any;
    return json(await service.getWorkspaces('', env));
  }
  if (env.ASSETS && typeof env.ASSETS.fetch === 'function' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  return json({ error: 'Not Found', path: url.pathname }, 404);
}

export default { fetch: fetchHandler };

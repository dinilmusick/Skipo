import { handleHttpsRequest } from "./backend/adapters/httpsAdapter.js";
import { proxyLuthAuthRequest } from "./backend/auth/luthSession.js";

/**
 * Canonical Web-standard application entrypoint.
 * All provider adapters delegate to this handler; add application routes here.
 */
export interface SkipoEnv {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

export async function fetch(
  request: Request,
  env: SkipoEnv = {},
  _ctx?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const authProxy = await proxyLuthAuthRequest(request);
  if (authProxy) return authProxy;
  const mcp = await externalInterfaces.mcp(request);
  if (mcp) return mcp;
  const http = await externalInterfaces.http(request);
  if (http) return http;
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    return Response.json({ status: "ok", runtime: "fetch" }, { headers: cors });
  }
  if (env.ASSETS && !url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }
  return Response.json({ error: "Not Found" }, { status: 404, headers: cors });
}

export default { fetch };

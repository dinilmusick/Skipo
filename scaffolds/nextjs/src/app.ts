import { fetchHandler } from "./backend/adapters/httpsAdapter.js";

export async function fetch(request: Request, env: Record<string, unknown> = {}, _ctx?: unknown): Promise<Response> {
  return fetchHandler(request, env as any);
}

export default { fetch };

import { ecosystem } from '../backend/ecosystem/AppEcosystem_Impure.js';
import { fetchHandler } from '../backend/adapters/httpsAdapter.js';

/** Cloudflare Worker adapter; all routes share the Web-standard Fetch handler. */
export default {
  scheduled(_event: unknown, env: Record<string, unknown>) {
    return ecosystem.heartbeat(env, true);
  },
  fetch(request: Request, env: any, _ctx: unknown) {
    return fetchHandler(request, env);
  },
};

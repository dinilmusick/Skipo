import { ecosystem } from '../backend/ecosystem/AppEcosystem_Impure.js';
import { fetch as fetchHandler } from '../app.js';

/** Cloudflare Worker adapter; all routes share the canonical Web Fetch handler. */
export default {
  scheduled(_event: unknown, env: Record<string, unknown>) {
    return ecosystem.heartbeat(env, true);
  },
  fetch(request: Request, env: any, _ctx: unknown) {
    return fetchHandler(request, env);
  },
};

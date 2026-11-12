import { fetch } from "../app.js";

/** Cloudflare Worker adapter; application behavior remains in ../app.ts. */
export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    return fetch(request, env, ctx);
  },
};

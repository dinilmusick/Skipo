/**
 * @file vercelEntry.ts
 * @description Vercel Serverless Function entrypoint.
 * Bridges Node.js req/res to universal fetchHandler (< 200 lines).
 */

import { fetchHandler, Env } from './httpsAdapter';
import { adaptNodeRequest } from './nodeBridge';

export default async function handler(req: any, res: any) {
  return adaptNodeRequest(req, res, (request: Request) =>
    fetchHandler(request, process.env as unknown as Env)
  );
}

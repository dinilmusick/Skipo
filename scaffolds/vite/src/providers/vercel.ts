import type { IncomingMessage, ServerResponse } from 'node:http';
import { adaptNodeRequest } from '../backend/adapters/nodeBridge.js';
import { fetchHandler } from '../backend/adapters/httpsAdapter.js';

export const config = { api: { bodyParser: false } };

export default function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  return adaptNodeRequest(request, response, fetchHandler, process.env);
}

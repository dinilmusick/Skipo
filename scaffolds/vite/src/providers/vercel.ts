import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchNodeRequest } from './nodeRequestAdapter.js';
import { fetch as fetchHandler } from '../app.js';

export const config = { api: { bodyParser: false } };

export default function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  return dispatchNodeRequest(request, response, fetchHandler, process.env);
}

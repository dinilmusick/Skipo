import { createServer, type Server } from 'node:http';
import {
  createGuestWorkspaceAuthorityHandler,
  type GuestWorkspaceAuthorityHandlerOptions,
} from './GuestWorkspaceAuthority.js';

export interface GuestWorkspaceAuthorityServerOptions extends GuestWorkspaceAuthorityHandlerOptions {
  maxRequestBytes?: number;
}

/**
 * Hosts the volatile authority as a single Node process. Put this server behind
 * a private HTTPS ingress; never expose its service token to browsers.
 */
export function createGuestWorkspaceAuthorityServer(
  options: GuestWorkspaceAuthorityServerOptions,
): Server {
  const handler = createGuestWorkspaceAuthorityHandler(options);
  const maxRequestBytes = options.maxRequestBytes ?? options.maxBodyBytes ?? 16 * 1024 * 1024;
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes <= 0) {
    throw new Error('maxRequestBytes must be a positive integer');
  }

  return createServer(async (incoming, outgoing) => {
    try {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of incoming) {
        const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
        total += bytes.byteLength;
        if (total > maxRequestBytes) {
          outgoing.writeHead(413, { 'cache-control': 'no-store', 'content-type': 'application/json' });
          outgoing.end(JSON.stringify({ error: { code: 'BODY_TOO_LARGE' } }));
          incoming.destroy();
          return;
        }
        chunks.push(bytes);
      }

      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (typeof value === 'string') headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(', '));
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const method = incoming.method ?? 'GET';
      const request = new Request(
        new URL(incoming.url ?? '/', 'http://' + (incoming.headers.host ?? 'localhost')),
        {
          method,
          headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : body,
        },
      );
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!outgoing.headersSent) {
        outgoing.writeHead(503, { 'cache-control': 'no-store', 'content-type': 'application/json' });
      }
      outgoing.end(JSON.stringify({ error: { code: 'AUTHORITY_FAILURE' } }));
    }
  });
}

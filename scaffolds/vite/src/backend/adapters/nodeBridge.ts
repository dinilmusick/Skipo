/**
 * Node-only Fetch bridge. The Vercel provider uses the same checked body,
 * header, and error translation as the standalone Node HTTP implementation.
 * Do not import this adapter from browser or Cloudflare runtime bundles.
 */
export { dispatchNodeRequest as adaptNodeRequest } from '../../providers/nodeRequestAdapter.js';
export type { FetchHandler } from '../../providers/nodeRequestAdapter.js';

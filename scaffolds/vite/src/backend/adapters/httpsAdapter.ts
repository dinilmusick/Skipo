/**
 * Compatibility adapter: all HTTP and MCP traffic uses the canonical Fetch app.
 */
export { fetch as fetchHandler, default } from '../../app.js';
export type { SkipoEnv as Env } from '../../app.js';

import { externalInterfaces } from '../AppBackend.js';

/**
 * Shared HTTPS boundary for the provider-independent Fetch application.
 * HTTP capability routes and MCP requests use the same authenticated registry.
 */
export async function handleHttpsRequest(request: Request): Promise<Response | null> {
  const mcp = await externalInterfaces.mcp(request);
  if (mcp) return mcp;
  return externalInterfaces.http(request);
}

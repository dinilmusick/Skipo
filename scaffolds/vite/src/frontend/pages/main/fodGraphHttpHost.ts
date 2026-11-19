import type { AuthenticatedRequest } from './agentChatHttpHost.js';

/**
 * Browser transport for Floks FodModule. Every request goes through the
 * owning application's authenticated Kloks/Luth API; this client is NOT the
 * workflow engine and is never a source of authorization.
 */
function basePath(path: string): string {
  if (!/^\/api\/(?!\/)[a-z0-9/_-]+$/i.test(path)) throw new Error('Graph runtime requires a same-origin application API path');
  return path.replace(/\/$/, '');
}
type GraphOutcome = {success: boolean; output: unknown; errors: Array<{message: string}>};
async function json(request: AuthenticatedRequest, url: string, init: RequestInit): Promise<any> {
  const response = await request(url, {...init, credentials: 'include', cache: 'no-store'});
  if (!response.ok) throw new Error('Authenticated graph operation denied or unavailable');
  return response.json();
}
function outcome(value: any): GraphOutcome {
  if (!value || typeof value.success !== 'boolean' || !Array.isArray(value.errors) ||
      !value.errors.every((error: unknown) => !!error && typeof (error as any).message === 'string') ||
      !Object.prototype.hasOwnProperty.call(value, 'output'))
    throw new Error('Invalid authenticated graph execution reply');
  return {success: value.success, output: value.output, errors: value.errors};
}
export function createAuthenticatedFodGraphHttpRuntime(
  request: AuthenticatedRequest,
  paths: {flows: string; authorizedNodes: string; executeRemote: string; executeLocal?: string},
) {
  const flows = basePath(paths.flows);
  const authorized = basePath(paths.authorizedNodes);
  const remote = basePath(paths.executeRemote);
  const local = paths.executeLocal ? basePath(paths.executeLocal) : undefined;
  return {
    async listFlows(): Promise<any[]> {
      const rows = await json(request, flows, {method: 'GET'});
      if (!Array.isArray(rows)) throw new Error('Invalid authenticated workflow list');
      return rows;
    },
    async getFlow(id: string): Promise<any | null> {
      return await json(request, `${flows}/${encodeURIComponent(id)}`, {method: 'GET'});
    },
    async saveFlow(flow: any): Promise<any> {
      if (!flow || typeof flow.id !== 'string') throw new Error('A versioned flow ID is required');
      const saved = await json(request, flows, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(flow),
      });
      if (!saved || saved.id !== flow.id) throw new Error('Invalid authenticated workflow save response');
      return saved;
    },
    async deleteFlow(id: string): Promise<boolean> {
      const result = await json(request, `${flows}/${encodeURIComponent(id)}`, {method: 'DELETE'});
      if (!result || typeof result.deleted !== 'boolean') throw new Error('Invalid workflow delete reply');
      return result.deleted;
    },
    async executeFlow(id: string): Promise<GraphOutcome> {
      if (!local) throw new Error('Local graph execution is not configured');
      return outcome(await json(request, local, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({flowId: id}),
      }));
    },
    async listAuthorizedNodeDefinitions(workspaceId: string): Promise<any[]> {
      // Caller/workspace association MUST be reverified by the owning server.
      const definitions = await json(request, `${authorized}?workspaceId=${encodeURIComponent(workspaceId)}`, {method: 'GET'});
      if (!Array.isArray(definitions)) throw new Error('Invalid authorized remote node list');
      return definitions;
    },
    async executeAuthorizedRemoteFlow(
      payload: {flowId: string; sourceWorkspaceId: string; handles: unknown[]},
      options: {signal: AbortSignal},
    ): Promise<GraphOutcome> {
      return outcome(await json(request, remote, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload), signal: options.signal,
      }));
    },
    // Deliberately no authorizeActiveFrontendWindow default. Session-front-end
    // operations must have an explicitly scoped user consent callback.
  };
}

import type { AgentChatBinding, AgentInvocation, AgentReply, ScopedAgentChatHost } from './agentChatHost.js';

/** Authenticated same-origin application API, for example Skipo's luthFetch. */
export type AuthenticatedRequest = (path: string, init: RequestInit) => Promise<Response>;

function apiPath(path: string): string {
  if (!/^\/api\/(?!\/)[a-z0-9/_-]+$/i.test(path)) throw new Error('Agent Chat requires a same-origin application API path');
  return path;
}
function validReply(value: unknown): value is AgentReply {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Partial<AgentReply>;
  if (!['completed', 'needs_input', 'failed'].includes(reply.kind ?? '') ||
      typeof reply.text !== 'string') return false;
  if (reply.kind === 'needs_input' && (typeof reply.invocationId !== 'string' || !reply.invocationId.trim())) return false;
  if (reply.fields !== undefined && (!Array.isArray(reply.fields) || reply.fields.length > 16 ||
    !reply.fields.every(field => field && typeof field.key === 'string' && !!field.key.trim() &&
      typeof field.label === 'string' && ['text', 'number', 'boolean'].includes(field.type)))) return false;
  return true;
}

/**
 * Transport-only adapter to the owning app's authenticated Kloks endpoint.
 * Never directly sends a browser caller identity or an arbitrary remote URL.
 * The server re-verifies Luth, workspace, grants, budgets and target for each
 * invocation, continuation and cancellation.
 */
export function createAuthenticatedAgentChatHttpHost(
  identity: Pick<ScopedAgentChatHost, 'principalId' | 'workspaceId' | 'scopeKey' | 'targets' | 'appAgentId'>,
  transport: {request: AuthenticatedRequest; invokePath: string; cancelPath?: string},
): ScopedAgentChatHost {
  const invokePath = apiPath(transport.invokePath);
  const cancelPath = transport.cancelPath ? apiPath(transport.cancelPath) : undefined;
  const post = async (path: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const response = await transport.request(path, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body), signal, credentials: 'include', cache: 'no-store',
    });
    if (!response.ok) throw new Error('Authenticated Kloks operation was denied or unavailable');
    return response.json();
  };
  const onInvoke: AgentChatBinding['onInvoke'] = async (invocation: AgentInvocation, options) => {
    const result = await post(invokePath, invocation, options?.signal);
    if (!validReply(result)) throw new Error('Invalid authenticated Kloks Agent Chat reply');
    return result;
  };
  return {
    ...identity, onInvoke,
    onCancel: cancelPath ? async target => { await post(cancelPath, target); } : undefined,
  };
}

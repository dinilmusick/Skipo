/**
 * Presentation-only Luth/Kloks binding for the managed Floks Agent Chat.
 * Only the owning application backend may issue an authorized directory,
 * invocation, continuation or cancellation. This gate is defense in depth.
 */
export type AgentKind = 'app' | 'endpoint' | 'workflow';
export interface AgentTarget {
  id: string;
  kind: AgentKind;
  name: string;
  alias?: string;
}
export interface AgentInvocation {
  targetId: string;
  targetKind: AgentKind;
  prompt: string;
  resumeInvocationId?: string;
  parameters?: Record<string, string | number | boolean>;
}
export interface AgentReply {
  kind: 'completed' | 'needs_input' | 'failed';
  text: string;
  invocationId?: string;
  fields?: readonly {key: string; label: string; type: 'text' | 'number' | 'boolean'; required?: boolean}[];
}
export interface AgentChatBinding {
  scopeKey: string;
  targets: readonly AgentTarget[];
  appAgentId?: string;
  onInvoke: (request: AgentInvocation, options?: {signal: AbortSignal}) => Promise<AgentReply>;
  onCancel?: (request: {targetId: string; targetKind: AgentKind; invocationId?: string}) => Promise<void> | void;
}
export interface ScopedAgentChatHost extends AgentChatBinding {
  /** Identity resolved by Luth; never derived from a user-editable label. */
  principalId: string;
  workspaceId: string;
}
export interface AgentScope {
  principalId?: string;
  workspaceId?: string;
  isGuest?: boolean;
}

/** Fail closed on a missing/stale host, duplicate identity or unauthorized default target. */
export function bindAuthorizedAgentChat(host: ScopedAgentChatHost | undefined, context: AgentScope): AgentChatBinding | undefined {
  if (context.isGuest || !context.principalId?.trim() || !context.workspaceId?.trim() ||
      !host || host.principalId !== context.principalId || host.workspaceId !== context.workspaceId ||
      !host.scopeKey?.trim() || typeof host.onInvoke !== 'function' ||
      !Array.isArray(host.targets) || !host.targets.length) return undefined;
  const seen = new Set<string>();
  const targets: AgentTarget[] = [];
  for (const entry of host.targets) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() ||
        typeof entry.name !== 'string' || !entry.name.trim() ||
        !['app', 'endpoint', 'workflow'].includes(entry.kind) ||
        (entry.alias !== undefined && typeof entry.alias !== 'string') ||
        seen.has(entry.id)) return undefined;
    seen.add(entry.id);
    targets.push({id: entry.id, kind: entry.kind, name: entry.name, ...(entry.alias ? {alias: entry.alias} : {})});
  }
  if (host.appAgentId && !targets.some(target => target.id === host.appAgentId && target.kind === 'app')) return undefined;
  const allowed = new Set(targets.map(target => `${target.kind}:${target.id}`));
  return {
    scopeKey: host.scopeKey,
    targets,
    appAgentId: host.appAgentId,
    onInvoke: (request, options) => {
      if (!allowed.has(`${request.targetKind}:${request.targetId}`))
        return Promise.reject(new Error('Selected agent is no longer in the authorized directory'));
      // Backend must re-resolve the Luth caller, exact target and scope for EACH call.
      return host.onInvoke(request, options);
    },
    onCancel: host.onCancel ? request => {
      if (!allowed.has(`${request.targetKind}:${request.targetId}`))
        return Promise.reject(new Error('Selected agent is no longer in the authorized directory'));
      return host.onCancel!(request);
    } : undefined,
  };
}

import type { ComponentType } from 'react';
import type { AgentScope, ScopedAgentChatHost } from './agentChatHost.js';

/**
 * The host provides Floks FodModule as GraphComponent and an authenticated
 * Kloks-backed FodRuntimeLike. Skipo does not reimplement ExecutionFlow.
 * BackendFacade must reauthorize every list, save and invocation.
 */
export interface ScopedGraphHost {
  principalId: string;
  workspaceId: string;
  scopeKey: string;
  GraphComponent: ComponentType<any>;
  runtime: {
    listAuthorizedNodeDefinitions: (workspaceId: string) => Promise<unknown[]>;
    executeAuthorizedRemoteFlow: (request: unknown, options: {signal: AbortSignal}) => Promise<unknown>;
    [key: string]: unknown;
  };
  nodeDefinitions?: readonly unknown[];
}
export interface ScopedUniversalUiHost {
  agentChat?: ScopedAgentChatHost;
  graph?: ScopedGraphHost;
}
export function bindAuthorizedGraph(host: ScopedGraphHost | undefined, context: AgentScope): ScopedGraphHost | undefined {
  if (context.isGuest || !context.principalId?.trim() || !context.workspaceId?.trim() ||
      !host || host.principalId !== context.principalId ||
      host.workspaceId !== context.workspaceId || !host.scopeKey?.trim() ||
      typeof host.GraphComponent !== 'function' ||
      !host.runtime || typeof host.runtime.listAuthorizedNodeDefinitions !== 'function' ||
      typeof host.runtime.executeAuthorizedRemoteFlow !== 'function') return undefined;
  return host;
}

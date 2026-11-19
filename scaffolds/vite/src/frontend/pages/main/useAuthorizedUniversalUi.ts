'use client';

import {lazy, useEffect, useState} from 'react';
import {getSkipoApplicationId, luthFetch} from '../../../libraries/client/luthAuthClient.js';
import {createAuthenticatedAgentChatHttpHost} from './agentChatHttpHost.js';
import {createAuthenticatedFodGraphHttpRuntime} from './fodGraphHttpHost.js';
import type {AgentTarget} from './agentChatHost.js';
import type {ScopedUniversalUiHost} from './universalGraphHost.js';

/*
 * This is a lazy presentation import, not a new graph execution engine.
 * Aiko-disabled applications never load the graph module at runtime.
 */
const GraphComponent = lazy(() =>
  import('@ultrst-armada/floks/canvas-ui/fod').then(({FodModule}) => ({default: FodModule}))
);

export interface UniversalUiScope {
  principalId: string;
  workspaceId: string;
  applicationId: string;
}
export interface UniversalUiDirectory {
  principalId: string;
  workspaceId: string;
  applicationId: string;
  scopeKey: string;
  targets?: AgentTarget[];
  appAgentId?: string;
  graphEnabled?: boolean;
  cancelEnabled?: boolean;
}
const endpoints = {
  directory: '/api/ultrst/ui/available',
  invoke: '/api/ultrst/ui/agent-invoke',
  cancel: '/api/ultrst/ui/agent-cancel',
  flows: '/api/ultrst/ui/flows',
  authorizedNodes: '/api/ultrst/ui/authorized-nodes',
  executeRemote: '/api/ultrst/ui/execute-remote',
} as const;

function validTargets(value: unknown): value is AgentTarget[] {
  if (!Array.isArray(value) || value.length > 500) return false;
  const seen = new Set<string>();
  return value.every(target => {
    if (!target || typeof target !== 'object' ||
      typeof target.id !== 'string' || !target.id.trim() ||
      typeof target.name !== 'string' || !target.name.trim() ||
      !['app', 'endpoint', 'workflow'].includes(target.kind) ||
      (target.alias !== undefined && (typeof target.alias !== 'string' || target.alias.length > 80)) ||
      seen.has(target.id)) return false;
    seen.add(target.id);
    return true;
  });
}

/**
 * Parse a request-time, caller-authorized Luth/Kloks directory. Browser
 * metadata only selects UI; every operation is reauthorized by its server.
 */
export function makeScopedUniversalUi(
  raw: unknown,
  scope: UniversalUiScope,
  request: typeof luthFetch,
): ScopedUniversalUiHost | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<UniversalUiDirectory>;
  if (value.principalId !== scope.principalId || value.workspaceId !== scope.workspaceId ||
      value.applicationId !== scope.applicationId ||
      typeof value.scopeKey !== 'string' || !value.scopeKey.trim() ||
      (value.targets !== undefined && !validTargets(value.targets)) ||
      (value.graphEnabled !== undefined && typeof value.graphEnabled !== 'boolean') ||
      (value.cancelEnabled !== undefined && typeof value.cancelEnabled !== 'boolean')) return undefined;
  const targets = value.targets ?? [];
  if (value.appAgentId && !targets.some(target => target.kind === 'app' && target.id === value.appAgentId))
    return undefined;
  const identity = {
    principalId: scope.principalId, workspaceId: scope.workspaceId,
    scopeKey: value.scopeKey,
  };
  const agentChat = targets.length ? createAuthenticatedAgentChatHttpHost({
    ...identity, targets, appAgentId: value.appAgentId,
  }, {request, invokePath: endpoints.invoke,
    ...(value.cancelEnabled ? {cancelPath: endpoints.cancel} : {})}) : undefined;
  const graph = value.graphEnabled ? {
    ...identity, GraphComponent,
    runtime: createAuthenticatedFodGraphHttpRuntime(request, {
      flows: endpoints.flows, authorizedNodes: endpoints.authorizedNodes,
      executeRemote: endpoints.executeRemote,
    }),
    nodeDefinitions: [],
  } : undefined;
  if (!agentChat && !graph) return undefined;
  return {agentChat, graph};
}

/** HTTP 404 means this application has no installed agent host; never fake one. */
export async function fetchScopedUniversalUi(
  scope: UniversalUiScope,
  request: typeof luthFetch = luthFetch,
  signal?: AbortSignal,
): Promise<ScopedUniversalUiHost | undefined> {
  const url = `${endpoints.directory}?workspaceId=${encodeURIComponent(scope.workspaceId)}`;
  const response = await request(url, {
    method: 'GET', cache: 'no-store', credentials: 'include', signal,
  });
  if (response.status === 404 || response.status === 204) return undefined;
  if (!response.ok) throw new Error('Authenticated agent directory denied or unavailable');
  return makeScopedUniversalUi(await response.json(), scope, request);
}

/**
 * Fetch on workspace/session entry, on reconnect/focus, and periodically so
 * grants, deployment leases, and publication revocations retire stale UI.
 * An identity change invalidates the old scope in the SAME render.
 */
/**
 * Reuse stable host callbacks during unchanged 15-second polling: replacing
 * the Floks graph runtime every tick would abort valid in-flight executions.
 * A changed scope or directory must still remount affected UI immediately.
 */
export function sameAuthorizedUi(
  previous: ScopedUniversalUiHost | undefined,
  next: ScopedUniversalUiHost | undefined,
): boolean {
  if (!previous || !next) return previous === next;
  const previousChat = previous.agentChat;
  const nextChat = next.agentChat;
  return previousChat?.scopeKey === nextChat?.scopeKey &&
    previous.graph?.scopeKey === next.graph?.scopeKey &&
    Boolean(previousChat?.onCancel) === Boolean(nextChat?.onCancel) &&
    previousChat?.appAgentId === nextChat?.appAgentId &&
    JSON.stringify(previousChat?.targets ?? []) === JSON.stringify(nextChat?.targets ?? []);
}

export function useAuthorizedUniversalUi(
  principalId: string | undefined,
  workspaceId: string | undefined,
  enabled = true,
): ScopedUniversalUiHost | undefined {
  const applicationId = getSkipoApplicationId();
  const [state, setState] = useState<{
    principalId: string; workspaceId: string; host?: ScopedUniversalUiHost;
  } | null>(null);
  useEffect(() => {
    if (!enabled || !principalId?.trim() || !workspaceId?.trim()) {
      setState(null);
      return;
    }
    let alive = true;
    let revision = 0;
    let current: AbortController | null = null;
    const scope: UniversalUiScope = {principalId, workspaceId, applicationId};
    const refresh = () => {
      const request = ++revision;
      current?.abort();
      const controller = new AbortController();
      current = controller;
      void fetchScopedUniversalUi(scope, luthFetch, controller.signal)
        .then(host => {
          if (alive && request === revision) setState(previous => {
            if (previous?.principalId === principalId && previous.workspaceId === workspaceId &&
                sameAuthorizedUi(previous.host, host)) return previous;
            return {principalId, workspaceId, host};
          });
        })
        .catch(() => {
          // Authentication failure, disconnected service, or malformed directory
          // clears the UI. No stored/optimistic agent grants are reused.
          if (alive && request === revision) setState({principalId, workspaceId});
        });
    };
    refresh();
    const interval = setInterval(refresh, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false; ++revision; current?.abort();
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [principalId, workspaceId, applicationId, enabled]);
  return enabled && principalId === state?.principalId && workspaceId === state?.workspaceId
    ? state.host : undefined;
}

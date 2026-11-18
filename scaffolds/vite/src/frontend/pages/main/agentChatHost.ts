import type { ComponentProps } from 'react';
import type { AppShell } from '@ultrst-armada/floks/ui';

/**
 * Trust boundary for host-provided Kloks/Luth Agent Chat.
 *
 * The backend MUST resolve the Luth caller, select the workspace, list only
 * caller-authorized AikoDirectoryEntry targets and reauthorize every invoke,
 * resume and cancellation. This client-side gate is additional isolation,
 * never a substitute for server-side access control.
 */
export type ScopedAgentChatHost = NonNullable<ComponentProps<typeof AppShell>['agentChat']> & {
  readonly principalId: string;
  readonly workspaceId: string;
};

/**
 * Reject directory/invoker bindings from a previous principal or workspace.
 * scopeKey is a non-secret revision supplied by the auth host; it MUST change
 * on login/logout, principal, app, workspace, session epoch and grant changes.
 * Keep the display-only scope markers out of the Floks invocation contract.
 */
export function bindAuthorizedAgentChat(
  host: ScopedAgentChatHost | undefined,
  context: { principalId?: string; workspaceId?: string; isGuest?: boolean },
): ComponentProps<typeof AppShell>['agentChat'] {
  if (context.isGuest || !context.principalId?.trim() || !context.workspaceId?.trim() ||
    !host || !host.scopeKey?.trim() || host.principalId !== context.principalId ||
    host.workspaceId !== context.workspaceId ||
    !host.onInvoke || !host.targets?.length) return undefined;

  // A directory must be the caller-authorized Kloks projection, not an
  // ambiguous collection. Aliases remain display-only; stable IDs route calls.
  const seen = new Set<string>();
  for (const target of host.targets) {
    if (!target || typeof target.id !== 'string' || !target.id.trim() ||
      typeof target.name !== 'string' || !target.name.trim() ||
      !['app', 'endpoint', 'workflow'].includes(target.kind) ||
      seen.has(target.id)) return undefined;
    seen.add(target.id);
  }
  if (host.appAgentId && !host.targets.some(
    target => target.id === host.appAgentId && target.kind === 'app'
  )) return undefined;

  return {
    scopeKey: host.scopeKey,
    targets: host.targets,
    appAgentId: host.appAgentId,
    onInvoke: host.onInvoke,
    onCancel: host.onCancel,
  };
}

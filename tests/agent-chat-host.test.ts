import { describe, expect, it, vi } from 'vitest';
import { bindAuthorizedAgentChat, type ScopedAgentChatHost } from
  '../scaffolds/vite/src/frontend/pages/main/agentChatHost.js';

const base = {
  principalId: 'alice',
  workspaceId: 'workspace-a',
  scopeKey: 'luth-session-1-grants-1',
  targets: [{ id: 'app-agent', kind: 'app' as const, name: 'App Agent' }],
  appAgentId: 'app-agent',
  onInvoke: vi.fn().mockResolvedValue({ kind: 'completed', text: 'ok' }),
} satisfies ScopedAgentChatHost;

const context = { principalId: 'alice', workspaceId: 'workspace-a', isGuest: false };

describe('Skipo Vite Agent Chat host binding', () => {
  it('forwards only the exact Luth principal and workspace scoped binding', () => {
    const result = bindAuthorizedAgentChat(base, context);
    expect(result).toMatchObject({
      scopeKey: 'luth-session-1-grants-1',
      appAgentId: 'app-agent',
      targets: base.targets,
      onInvoke: base.onInvoke,
    });
    expect(result).not.toHaveProperty('principalId');
    expect(result).not.toHaveProperty('workspaceId');
  });

  it('denies guest, missing session, mismatched principal or workspace', () => {
    expect(bindAuthorizedAgentChat(base, { ...context, isGuest: true })).toBeUndefined();
    expect(bindAuthorizedAgentChat(base, { ...context, principalId: undefined })).toBeUndefined();
    expect(bindAuthorizedAgentChat(base, { ...context, principalId: 'bob' })).toBeUndefined();
    expect(bindAuthorizedAgentChat(base, { ...context, workspaceId: 'workspace-b' })).toBeUndefined();
    expect(bindAuthorizedAgentChat(base, { ...context, workspaceId: undefined })).toBeUndefined();
  });

  it('rejects missing or stale authorization binding instead of handing an invoker to the UI', () => {
    expect(bindAuthorizedAgentChat(undefined, context)).toBeUndefined();
    expect(bindAuthorizedAgentChat({ ...base, scopeKey: '' }, context)).toBeUndefined();
    expect(bindAuthorizedAgentChat({ ...base, targets: [] }, context)).toBeUndefined();
    expect(bindAuthorizedAgentChat({ ...base, onInvoke: undefined }, context)).toBeUndefined();
  });

  it('fails closed on duplicate agent IDs, malformed kinds or an unlisted app agent', () => {
    expect(bindAuthorizedAgentChat({
      ...base, targets: [...base.targets, { ...base.targets[0] }],
    }, context)).toBeUndefined();
    expect(bindAuthorizedAgentChat({
      ...base, targets: [{ id: 'app-agent', kind: 'unknown' as 'app', name: 'Forgery' }],
    }, context)).toBeUndefined();
    expect(bindAuthorizedAgentChat({
      ...base, appAgentId: 'missing-agent',
    }, context)).toBeUndefined();
  });

  it('passes a fresh grant revision only from a fresh supplied host context', () => {
    const fresh = { ...base, scopeKey: 'luth-session-1-grants-2' };
    expect(bindAuthorizedAgentChat(fresh, context)?.scopeKey).toBe('luth-session-1-grants-2');
    expect(bindAuthorizedAgentChat({ ...base, workspaceId: 'workspace-b' },
      context)).toBeUndefined();
  });
});

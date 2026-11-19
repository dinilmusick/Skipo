import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { bindAuthorizedAgentChat, type ScopedAgentChatHost } from '../scaffolds/vite/src/frontend/pages/main/agentChatHost.js';
import { bindAuthorizedGraph, type ScopedGraphHost } from '../scaffolds/vite/src/frontend/pages/main/universalGraphHost.js';

const appScope = {principalId: 'luth-user-a', workspaceId: 'workspace-a'};
const targets = [
  {id: 'app-agent', kind: 'app' as const, name: 'App Agent'},
  {id: 'endpoint-agent', kind: 'endpoint' as const, name: 'Endpoint Agent'},
  {id: 'workflow-agent', kind: 'workflow' as const, name: 'Workflow Agent'},
];
function chat(overrides: Partial<ScopedAgentChatHost> = {}): ScopedAgentChatHost {
  return {
    principalId: 'luth-user-a', workspaceId: 'workspace-a',
    scopeKey: 'app-a/session-a/workspace-a/grant-1',
    targets, appAgentId: 'app-agent',
    onInvoke: vi.fn(async () => ({kind: 'needs_input', text: 'Provide a value', invocationId: 'resume-canonical', fields: [{key: 'count', type: 'number', label: 'Count'}]})),
    onCancel: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('Skipo Floks Agent Chat Luth/Kloks host gate', () => {
  it('rejects guest, missing principal, missing scope, mismatched user/workspace and missing invoker', () => {
    const host = chat();
    expect(bindAuthorizedAgentChat(host, {...appScope, isGuest: true})).toBeUndefined();
    expect(bindAuthorizedAgentChat(host, {workspaceId: 'workspace-a'})).toBeUndefined();
    expect(bindAuthorizedAgentChat(host, {...appScope, principalId: 'luth-user-b'})).toBeUndefined();
    expect(bindAuthorizedAgentChat(host, {...appScope, workspaceId: 'workspace-b'})).toBeUndefined();
    expect(bindAuthorizedAgentChat(chat({scopeKey: ''}), appScope)).toBeUndefined();
    expect(bindAuthorizedAgentChat(chat({onInvoke: undefined as never}), appScope)).toBeUndefined();
  });

  it('rejects duplicate stable IDs, malformed agents and unauthorized app default', () => {
    expect(bindAuthorizedAgentChat(chat({targets: [...targets, targets[0]]}), appScope)).toBeUndefined();
    expect(bindAuthorizedAgentChat(chat({targets: [{id: '', name: 'Fake', kind: 'app'}]}), appScope)).toBeUndefined();
    expect(bindAuthorizedAgentChat(chat({appAgentId: 'not-in-directory'}), appScope)).toBeUndefined();
  });

  it('retains the exact target, typed continuation and server cancellation without synthetic success', async () => {
    const host = chat();
    const bound = bindAuthorizedAgentChat(host, appScope)!;
    const request = {targetId: 'workflow-agent', targetKind: 'workflow' as const,
      prompt: 'continue', resumeInvocationId: 'resume-canonical', parameters: {count: 3, confirm: true}};
    expect(await bound.onInvoke(request, {signal: new AbortController().signal}))
      .toMatchObject({kind: 'needs_input', invocationId: 'resume-canonical'});
    expect(host.onInvoke).toHaveBeenCalledWith(request, expect.any(Object));
    await bound.onCancel?.({targetId: request.targetId, targetKind: request.targetKind, invocationId: 'resume-canonical'});
    expect(host.onCancel).toHaveBeenCalledOnce();
    await expect(bound.onInvoke({...request, targetId: 'forged'})).rejects.toThrow(/authorized directory/);
    expect(host.onInvoke).toHaveBeenCalledTimes(1);
  });

  it('keeps two independent applications isolated even when agents have matching display names', async () => {
    const appA = bindAuthorizedAgentChat(chat(), appScope)!;
    const executeB = vi.fn(async () => ({kind: 'completed' as const, text: 'from authorized app B'}));
    const appBhost = chat({principalId: 'luth-user-b', workspaceId: 'workspace-b',
      scopeKey: 'app-b/session-b/workspace-b/grant-7', appAgentId: undefined,
      targets: [{id: 'b-agent', kind: 'app', name: 'App Agent'}], onInvoke: executeB});
    expect(bindAuthorizedAgentChat(appBhost, appScope)).toBeUndefined();
    const appB = bindAuthorizedAgentChat(appBhost, {principalId: 'luth-user-b',workspaceId: 'workspace-b'})!;
    await expect(appB.onInvoke({targetId:'app-agent',targetKind:'app',prompt:'forged'})).rejects.toThrow();
    expect(executeB).not.toHaveBeenCalled();
    expect(appA.targets[0].id).toBe('app-agent');
    expect(appB.targets[0].id).toBe('b-agent');
    expect(await appB.onInvoke({targetId:'b-agent',targetKind:'app',prompt:'hello'})).toMatchObject({kind:'completed'});
  });
});

describe('Floks FOD graph host boundary', () => {
  const graph: ScopedGraphHost = {
    principalId: 'luth-user-a', workspaceId: 'workspace-a', scopeKey:'app-a/session-a/graph-rev-1',
    GraphComponent: (() => null),
    runtime: {
      listAuthorizedNodeDefinitions: vi.fn(async () => []),
      executeAuthorizedRemoteFlow: vi.fn(async () => ({success:false,output:null,errors:[]})),
    }, nodeDefinitions: [],
  };
  it('requires an authorized caller and Kloks revalidating operations', () => {
    expect(bindAuthorizedGraph(graph, appScope)).toBe(graph);
    expect(bindAuthorizedGraph(graph, {...appScope, isGuest:true})).toBeUndefined();
    expect(bindAuthorizedGraph(graph, {principalId:'luth-user-a',workspaceId:'other'})).toBeUndefined();
    expect(bindAuthorizedGraph({...graph,scopeKey:''}, appScope)).toBeUndefined();
    expect(bindAuthorizedGraph({...graph,runtime:{...graph.runtime,listAuthorizedNodeDefinitions:undefined as never}},appScope)).toBeUndefined();
  });
  it('preserves passive graph navigation through Floks FodModule rather than calling execution', () => {
    const main = readFileSync(new URL('../scaffolds/vite/src/frontend/pages/main/page.tsx', import.meta.url), 'utf8');
    const generated = readFileSync(new URL('../scaffolds/vite/src/frontend/App.tsx', import.meta.url), 'utf8');
    expect(main).toContain('createElement(authorizedGraph.GraphComponent');
    expect(main).toContain('nodeDefinitions: authorizedGraph.nodeDefinitions');
    expect(main).not.toMatch(/executeFlow\(|executeAuthorizedRemoteFlow\(/);
    expect(generated).toContain('selection?.principalId === principalId');
    expect(generated).not.toContain('AikoRuntime');
  });
});

import {describe, expect, it, vi} from 'vitest';
import {bindAuthorizedAgentChat} from '../scaffolds/vite/src/frontend/pages/main/agentChatHost.js';
import {
  fetchScopedUniversalUi, makeScopedUniversalUi,
} from '../scaffolds/vite/src/frontend/pages/main/useAuthorizedUniversalUi.js';

const appA = {principalId:'luth-user-a', workspaceId:'workspace-a',applicationId:'app-a'};
const appB = {principalId:'luth-user-b', workspaceId:'workspace-b',applicationId:'app-b'};
const catalog = (scope = appA, grant = '1') => ({
  ...scope,scopeKey: `${scope.applicationId}/${scope.principalId}/${scope.workspaceId}/session-1/grant-${grant}`,
  appAgentId: 'agent-immutable',
  targets:[{id:'agent-immutable',kind:'app',name:'The Assistant'},
    {id:'workflow-immutable',kind:'workflow',name:'My Workflow'}],
  graphEnabled: true,
});

describe('generated Vite canonical Luth/Kloks UI host discovery', () => {
  it('refuses wrong principal, app and workspace plus invalid grants and malformed descriptors', () => {
    const request = vi.fn();
    expect(makeScopedUniversalUi(catalog(appA), {...appA,principalId:'luth-user-b'}, request as never)).toBeUndefined();
    expect(makeScopedUniversalUi(catalog(appA), {...appA,workspaceId:'workspace-b'}, request as never)).toBeUndefined();
    expect(makeScopedUniversalUi(catalog(appA), {...appA,applicationId:'app-b'}, request as never)).toBeUndefined();
    expect(makeScopedUniversalUi({...catalog(),scopeKey:''},appA,request as never)).toBeUndefined();
    expect(makeScopedUniversalUi({...catalog(),appAgentId:'not-in-directory'},appA,request as never)).toBeUndefined();
    expect(makeScopedUniversalUi({...catalog(),targets:[...catalog().targets,catalog().targets[0]]},appA,request as never)).toBeUndefined();
    expect(makeScopedUniversalUi({...catalog(),targets:[]},appA,request as never)?.agentChat).toBeUndefined();
    expect(makeScopedUniversalUi({...catalog(),graphEnabled:'yes'},appA,request as never)).toBeUndefined();
  });

  it('does not synthesize any authority when a host is disabled or missing', async () => {
    const noHost = vi.fn(async () => new Response(null,{status:404}));
    expect(await fetchScopedUniversalUi(appA,noHost as never)).toBeUndefined();
    expect(noHost).toHaveBeenCalledWith(
      '/api/ultrst/ui/available?workspaceId=workspace-a',
      expect.objectContaining({method:'GET',cache:'no-store'}),
    );
    expect(makeScopedUniversalUi({...appA,scopeKey:'session-1',targets:[],graphEnabled:false},appA,noHost as never)).toBeUndefined();
    const forbidden=vi.fn(async()=>Response.json({error:'forbidden'},{status:403}));
    await expect(fetchScopedUniversalUi(appA,forbidden as never)).rejects.toThrow(/denied/);
  });

  it('isolates two independently authenticated app directories and remounts on grants revision', async () => {
    const requestA = vi.fn(async (path:string,init:RequestInit) => {
      if (path.includes('/available')) return Response.json(catalog(appA,'1'));
      if (path.endsWith('/agent-invoke')) return Response.json({kind:'needs_input',text:'More details',invocationId:'continuation-a'});
      return Response.json({cancelled:true});
    });
    const requestB = vi.fn(async (path:string,init:RequestInit) => {
      if (path.includes('/available')) return Response.json({...catalog(appB,'4'),
        targets:[{id:'agent-b',kind:'app',name:'The Assistant'}],appAgentId:'agent-b'});
      if (path.endsWith('/agent-invoke')) return Response.json({kind:'completed',text:'B'});
      return Response.json({cancelled:true});
    });
    const a = (await fetchScopedUniversalUi(appA,requestA as never))!;
    const b = (await fetchScopedUniversalUi(appB,requestB as never))!;
    expect(a.agentChat!.scopeKey).not.toBe(b.agentChat!.scopeKey);
    expect(a.agentChat!.targets[0].id).toBe('agent-immutable');
    expect(b.agentChat!.targets[0].id).toBe('agent-b');
    const boundB = bindAuthorizedAgentChat(b.agentChat!, {principalId:appB.principalId,workspaceId:appB.workspaceId})!;
    await expect(boundB.onInvoke({targetKind:'app',targetId:'agent-immutable',prompt:'forged'}))
      .rejects.toThrow(/authorized directory/);
    expect(requestB).toHaveBeenCalledTimes(1);
    expect(await boundB.onInvoke({targetKind:'app',targetId:'agent-b',prompt:'authorized'}))
      .toMatchObject({kind:'completed',text:'B'});
    expect(requestB.mock.calls[1][0]).toBe('/api/ultrst/ui/agent-invoke');
    const a2 = makeScopedUniversalUi(catalog(appA,'2'),appA,requestA as never)!;
    expect(a2.agentChat!.scopeKey).not.toBe(a.agentChat!.scopeKey);
    expect(a2.graph!.scopeKey).toBe(a2.agentChat!.scopeKey);
  });

  it('does not import FOD runtime or Aiko agents until an authorized graph is mounted', () => {
    const source = makeScopedUniversalUi({...catalog(),graphEnabled:false},appA,vi.fn() as never);
    expect(source?.graph).toBeUndefined();
    expect(source?.agentChat?.targets).toHaveLength(2);
  });
});

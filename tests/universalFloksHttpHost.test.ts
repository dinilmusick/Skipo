import { describe, expect, it, vi } from 'vitest';
import { createAuthenticatedAgentChatHttpHost } from '../scaffolds/vite/src/frontend/pages/main/agentChatHttpHost.js';
import { createAuthenticatedFodGraphHttpRuntime } from '../scaffolds/vite/src/frontend/pages/main/fodGraphHttpHost.js';
import { bindAuthorizedAgentChat } from '../scaffolds/vite/src/frontend/pages/main/agentChatHost.js';

const identity = {
  principalId: 'luth-a', workspaceId: 'workspace-a',
  scopeKey: 'app-a/session-a/grant-5',
  targets: [{id:'workflow-immutable',kind:'workflow' as const,name:'Workflow'}],
};

describe('authenticated Kloks browser transport contract', () => {
  it('forwards typed continuation and AbortSignal to only a same-origin app endpoint', async () => {
    const fetch = vi.fn(async (_path: string, _init: RequestInit) => Response.json({
      kind:'needs_input',text:'Need count',invocationId:'continuation-a',
      fields:[{key:'count',label:'Count',type:'number'}],
    }));
    const host = createAuthenticatedAgentChatHttpHost(identity, {
      request:fetch, invokePath:'/api/app/agent-invoke',
    });
    const bound = bindAuthorizedAgentChat(host, {principalId:'luth-a',workspaceId:'workspace-a'})!;
    const controller = new AbortController();
    const payload = {targetId:'workflow-immutable',targetKind:'workflow' as const,
      prompt:'Continue',resumeInvocationId:'continuation-a',parameters:{count:4}};
    expect(await bound.onInvoke(payload,{signal:controller.signal})).toMatchObject({
      kind:'needs_input', invocationId:'continuation-a',
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe('/api/app/agent-invoke');
    const options=fetch.mock.calls[0][1];
    expect(options.signal).toBe(controller.signal);
    expect(JSON.parse(options.body as string)).toEqual(payload);
    expect(options.credentials).toBe('include');
    expect(JSON.stringify(payload)).not.toContain('luth-a');
  });

  it('denies arbitrary URLs, rejected requests, malformed replies, and unbound remote targets', async () => {
    const reject = vi.fn(async () => Response.json({error:'forbidden'},{status:403}));
    expect(() => createAuthenticatedAgentChatHttpHost(identity,{
      request:reject,invokePath:'https://remote.example/api/agents',
    })).toThrow(/same-origin/);
    const host=createAuthenticatedAgentChatHttpHost(identity,{
      request:reject,invokePath:'/api/app/invoke',
    });
    await expect(host.onInvoke({targetId:'workflow-immutable',targetKind:'workflow',prompt:'x'})).rejects.toThrow(/denied/);
    const malformed=createAuthenticatedAgentChatHttpHost(identity,{
      request:async()=>Response.json({kind:'needs_input',text:'Missing verified continuation'}),
      invokePath:'/api/app/invoke',
    });
    await expect(malformed.onInvoke({targetId:'workflow-immutable',targetKind:'workflow',prompt:'x'})).rejects.toThrow(/Invalid/);
    const bound=bindAuthorizedAgentChat(malformed,{principalId:'luth-a',workspaceId:'workspace-a'})!;
    await expect(bound.onInvoke({targetId:'other',targetKind:'app',prompt:'x'})).rejects.toThrow(/authorized/);
  });

  it('sends cancellation to the owning app rather than pretending AbortSignal cancels server work', async () => {
    const fetch = vi.fn(async()=>Response.json({cancelled:true}));
    const host=createAuthenticatedAgentChatHttpHost(identity,{
      request:fetch,invokePath:'/api/app/invoke',cancelPath:'/api/app/cancel',
    });
    await host.onCancel?.({targetId:'workflow-immutable',targetKind:'workflow',invocationId:'live-17'});
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe('/api/app/cancel');
    expect(JSON.parse(fetch.mock.calls[0][1].body as string).invocationId).toBe('live-17');
  });

  it('retains exact graph handles and refuses fabricated execution success', async () => {
    const observed: Array<{url:string;init:RequestInit}> = [];
    const handle={appId:'kone',targetWorkspaceId:'target-w',operationId:'cap',
      operationVersion:'7'};
    const fetch=async (url:string,init:RequestInit) => {
      observed.push({url,init});
      if (url.endsWith('/authorized?workspaceId=source-w'))
        return Response.json([{type:'remote.kone.cap',metadata:handle,inputs:[],outputs:[]}]);
      if (url.endsWith('/invoke')) return Response.json({success:true,output:{done:1},errors:[]});
      return Response.json([]);
    };
    const runtime=createAuthenticatedFodGraphHttpRuntime(fetch,{
      flows:'/api/app/flows',authorizedNodes:'/api/app/authorized',executeRemote:'/api/app/invoke',
    });
    expect((await runtime.listAuthorizedNodeDefinitions('source-w'))[0].metadata).toEqual(handle);
    const controller=new AbortController();
    const result=await runtime.executeAuthorizedRemoteFlow(
      {flowId:'saved-flow',sourceWorkspaceId:'source-w',handles:[handle]},
      {signal:controller.signal},
    );
    expect(result.success).toBe(true);
    expect(JSON.parse(observed[1].init.body as string).handles[0]).toEqual(handle);
    expect(observed[1].init.signal).toBe(controller.signal);
    const denied=createAuthenticatedFodGraphHttpRuntime(
      async()=>Response.json({message:'okay'}),
      {flows:'/api/app/flows',authorizedNodes:'/api/app/authorized',executeRemote:'/api/app/invoke'},
    );
    await expect(denied.executeAuthorizedRemoteFlow(
      {flowId:'x',sourceWorkspaceId:'source-w',handles:[handle]},{signal:controller.signal},
    )).rejects.toThrow(/Invalid authenticated graph/);
    await expect(runtime.executeFlow('x')).rejects.toThrow(/not configured/);
  });
  it('requires explicit remote cancellation acknowledgment rather than accepting a generic HTTP success', async () => {
    const denied = createAuthenticatedAgentChatHttpHost(identity, {
      request: async () => Response.json({cancelled:false}),
      invokePath:'/api/app/invoke',cancelPath:'/api/app/cancel',
    });
    await expect(denied.onCancel?.({targetId:'workflow-immutable',targetKind:'workflow',invocationId:'in-flight'}))
      .rejects.toThrow(/confirm remote/);
    const accepted = createAuthenticatedAgentChatHttpHost(identity, {
      request: async () => new Response(null,{status:204}),
      invokePath:'/api/app/invoke',cancelPath:'/api/app/cancel',
    });
    await expect(accepted.onCancel?.({targetId:'workflow-immutable',targetKind:'workflow',invocationId:'in-flight'}))
      .resolves.toBeUndefined();
  });

});

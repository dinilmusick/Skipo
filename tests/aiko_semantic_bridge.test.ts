import {describe,expect,it} from 'vitest';
import {createSkipoAikoRuntime} from '../src/backend/semantic/SkipoAikoBridge.js';
import {createSkipoSemanticRuntime} from '../src/backend/semantic/SkipoSemanticRuntime.js';

describe('Skipo Aiko semantic bridge',()=>{
  it('exposes a universal application agent backed by the semantic runtime',async()=>{
    const runtime=createSkipoSemanticRuntime({applicationId:'test-app'});
    runtime.registerCapability({id:'echo',name:'Echo',description:'Echo text',kind:'endpoint',inputSchema:{type:'object',properties:{value:{type:'string'}}},metadata:{public:true}});
    runtime.setPlanner(async()=>({nodes:[{id:'echo-0',capabilityId:'echo',dependsOn:[],input:{value:'hello'}}]}));
    runtime.setExecutor({execute:async()=>({value:'hello'})});
    const aiko=createSkipoAikoRuntime({workspaceId:'ws',runtime,runtimeContext:{applicationId:'test-app',sessionId:'session-1'}});
    const agents=await aiko.listAgents();
    expect(agents.some(agent=>agent.id==='skipo-application-agent')).toBe(true);
    const result:any=await aiko.executeAgent('skipo-application-agent','say hello');
    expect(result.status).toBe('completed');
  });
});

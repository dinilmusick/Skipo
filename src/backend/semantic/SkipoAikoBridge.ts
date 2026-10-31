import {AikoRuntime,type AikoAgentDefinition,type AikoCapability} from '@ultrst-armada/kloks/aiko';
import {AIKeyServiceFacade} from '@ultrst-armada/kloks/krnl-ai-services';
import type {RuntimeContext} from '@ultrst-armada/kloks/semantic-runtime';
import type {SkipoSemanticRuntime} from './SkipoSemanticRuntime.js';

export interface SkipoAikoBridgeOptions {workspaceId:string;runtime:SkipoSemanticRuntime;runtimeContext:RuntimeContext;engineUrl?:string;moduleToken?:string;}

export function createSkipoAikoRuntime(options:SkipoAikoBridgeOptions):AikoRuntime {
  const resolver={resolve:async(specId?:string,context?:any)=>{
    if(!options.engineUrl)return {spec:{mode:'semantic-runtime',specId:specId??'skipo-semantic'},specId:specId??'skipo-semantic'};
    const response=await fetch(options.engineUrl.replace(/\\/$/,'')+'/api/module/resolve-intelligence',{method:'POST',headers:{'Content-Type':'application/json',...(options.moduleToken?{'x-aiko-module-token':options.moduleToken}:{})},body:JSON.stringify({specId,...context})});
    if(!response.ok)throw new Error('Aiko Engine intelligence resolver request failed.');
    return response.json();
  }};
  const capabilities=():AikoCapability[]=>options.runtime.capabilities.list().map(capability=>({
    id:capability.id,name:capability.name,description:capability.description,sourceKind:capability.kind==='fod-flow'?'fod-flow':capability.kind==='gutts'?'gutts-api':'endpoint',sourceId:capability.id,inputSchema:capability.inputSchema,
    execute:(input:unknown)=>options.runtime.execute(capability,input,options.runtimeContext)
  }));
  const applicationTool={id:'skipo.application',name:'Application Agent',description:'Universal Skipo application agent',inputSchema:{type:'object',properties:{request:{type:'string'}},required:['request']},sourceKind:'custom' as const,sourceId:'application',execute:async(input:unknown)=>{
    const request=typeof input==='string'?input:String((input as any)?.request??'');
    return options.runtime.handle(request,{...options.runtimeContext,sessionId:options.runtimeContext.sessionId});
  }};
  const applicationAgent:AikoAgentDefinition={schemaVersion:'1.0.0',id:'skipo-application-agent',name:'Application Agent',description:'Universal conversational application agent',agentType:'AIKO',tool:applicationTool,intelligenceSpec:{mode:'semantic-runtime'},sourceKind:'custom',sourceId:'application',custom:true};
  return new AikoRuntime({
    customAgents:[applicationAgent],capabilities,resolver,
    keys:{
      listKeys:async()=>AIKeyServiceFacade.getKeys() as any,
      getActiveKey:async(providerId:string)=>{const facade:any=AIKeyServiceFacade;return typeof facade.getActiveKey==='function'?facade.getActiveKey(providerId)??null:null;},
      rotateKey:async(providerId:string)=>{const facade:any=AIKeyServiceFacade;return typeof facade.rotateKey==='function'?facade.rotateKey(providerId)??null:null;},
      addKey:async(input:any)=>AIKeyServiceFacade.addKey(input) as any,
      syncFromAikoEngine:async()=>({synced:0,message:'Use the Aiko module account synchronizer to import keys.'})
    }
  });
}

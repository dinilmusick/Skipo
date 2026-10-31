import {
  CapabilityRegistry,
  ContextResolver,
  RequirementResolver,
  TaskGraphRuntime,
  TaskRuntime,
  type AgentContext,
  type CapabilityDescriptor,
  type Requirement,
  type RuntimeContext,
  type TaskNode,
  type TaskStore,
  type AuthorizationPolicy,
} from '@ultrst-armada/kloks/semantic-runtime';
import {guttsApiDefinitions,executeGuttsApi,resolveSemanticInput,rankSemanticInputCandidates} from '@dinilmusick/gutts';
import {skipoExecutionEngine} from '../execution/SkipoExecutionEngine.js';
import {CapabilityExecutionRuntime} from '@ultrst-armada/kloks/semantic-runtime';

import type {SemanticConversationStore} from './SkipoSemanticPersistence.js';

export interface SemanticAgentDescriptor {
  id:string; name:string; role:'application'|'endpoint'|'capability'; capabilityIds:string[];
}

export interface SemanticApplicationManifest {
  id:string; name:string; version:string;
  capabilities:CapabilityDescriptor[]; agents:SemanticAgentDescriptor[];
}

export interface SemanticRuntimeOptions {
  applicationId:string; applicationName?:string; applicationVersion?:string;
  knowledgeResolver?:ConstructorParameters<typeof ContextResolver>[1];
  taskStore?:TaskStore;
  conversationStore?:SemanticConversationStore;
  authorizationPolicy?:AuthorizationPolicy;
}

export interface SemanticPlan { intent?:string; nodes:Omit<TaskNode,'status'>[]; requirements?:Requirement[]; }

export interface SemanticRuntimeExecutor {
  execute(capability:CapabilityDescriptor,input:unknown,context:AgentContext):Promise<unknown>;
}

export interface SemanticPlanner {
  plan(request:string,context:AgentContext):Promise<SemanticPlan>;
}

function schemaForService(definition:any):any {
  return definition?.inputSchema??{type:'object',properties:{}};
}

function sideEffects(definition:any):CapabilityDescriptor['sideEffects'] {
  if(definition?.semantics?.sideEffects) return 'external';
  if(definition?.semantics?.pure) return 'compute';
  return 'compute';
}

export class SkipoSemanticRuntime {
  readonly capabilities=new CapabilityRegistry();
  readonly tasks:TaskRuntime;
  readonly graphs=new TaskGraphRuntime();
  readonly contextResolver:ContextResolver;
  readonly requirements:RequirementResolver;
  readonly agents=new Map<string,SemanticAgentDescriptor>();
  private readonly conversationStore?:SemanticConversationStore;
  private executor?:SemanticRuntimeExecutor;
  private readonly authorizationPolicy:AuthorizationPolicy;
  private planner?:SemanticPlanner;

  constructor(private readonly options:SemanticRuntimeOptions){
    this.tasks=new TaskRuntime(options.taskStore);
    this.authorizationPolicy=options.authorizationPolicy??{authorize:async(capability,context)=>{const requiredRoles=capability.metadata?.requiredRoles as string[]|undefined;const roles=(context.runtime.metadata?.roles as string[]|undefined)??[];if(requiredRoles?.length&&!requiredRoles.some(role=>roles.includes(role)))return {allowed:false,reason:'CAPABILITY_ROLE_FORBIDDEN'};if(capability.sideEffects==='irreversible'&&!context.runtime.userId)return {allowed:false,reason:'CAPABILITY_AUTH_REQUIRED'};if(['write','external'].includes(capability.sideEffects??'')&&!context.runtime.userId)return {allowed:false,reason:'CAPABILITY_AUTH_REQUIRED'};return {allowed:true};}};
    this.conversationStore=options.conversationStore;
    this.contextResolver=new ContextResolver(this.capabilities,options.knowledgeResolver);
    this.requirements=new RequirementResolver(this.capabilities);
    this.agents.set('application',{id:'application',name:options.applicationName??options.applicationId,role:'application',capabilityIds:[]});
  }

  setExecutor(executor:SemanticRuntimeExecutor):void { this.executor=executor; }
  setPlanner(planner:SemanticPlanner):void { this.planner=planner; }

  registerCapability(capability:CapabilityDescriptor):void{
    this.capabilities.upsert(capability);
    const agent=this.agents.get('application')!;
    if(!agent.capabilityIds.includes(capability.id)) agent.capabilityIds.push(capability.id);
  }

  registerAgent(agent:SemanticAgentDescriptor):void { this.agents.set(agent.id,agent); }

  registerService(serviceName:string,service:any):void{
    const operations=service?.definition?.operations??{};
    for(const [operation,definition] of Object.entries<any>(operations)){
      this.registerCapability({
        id:`${serviceName}.${operation}`,
        name:definition.name??operation,
        description:definition.description??`Execute ${operation} on ${serviceName}`,
        kind:'endpoint',
        inputSchema:schemaForService(definition),
        outputSchema:definition.outputSchema,
        requirements:(definition.requirements??[]).map((r:any)=>({...r,required:r.required!==false})),
        sideEffects:definition.sideEffects??'external',
        metadata:{service:serviceName,operation,provides:definition.provides??[]}
      });
    }
  }

  registerGutTS():void{
    for(const api of guttsApiDefinitions){
      this.registerCapability({
        id:api.id,
        name:api.name,
        description:api.description,
        kind:'gutts',
        inputSchema:api.inputSchema,
        outputSchema:api.output,
        requirements:api.parameters.map(p=>({
          id:p.name,semanticType:p.name,description:p.description,required:p.required,sourceField:p.name
        })),
        sideEffects:sideEffects(api),
        metadata:{apiId:api.id,category:api.category,deterministic:api.semantics.deterministic,pure:api.semantics.pure,provides:[api.id]}
      });
    }
  }


  async registerFodRuntime(fod: {listFlows():Promise<any[]>;executeFlow(flowId:string,input?:unknown):Promise<any>}):Promise<void>{
    for(const flow of await fod.listFlows()){
      this.registerCapability({
        id:String(flow.id),name:String(flow.name),description:String(flow.description??'Execute FOD flow'),kind:'fod-flow',
        inputSchema:flow.inputSchema,outputSchema:flow.outputSchema,sideEffects:'external',
        metadata:{source:'fod',flowId:String(flow.id),provides:[String(flow.id)],flowExecutor:(input:unknown)=>fod.executeFlow(String(flow.id),input)}
      });
    }
  }

  createTask(request:string,parentTaskId?:string,contextId?:string){
    const task=this.tasks.create(request,parentTaskId);
    if(contextId) task.context.contextId=contextId;
    return task;
  }

  async buildContext(runtime:RuntimeContext,taskId:string):Promise<AgentContext>{
    const task=this.tasks.get(taskId);
    if(!task) throw new Error(`Unknown semantic task: ${taskId}`);
    return this.contextResolver.resolve(runtime,task.context);
  }

  async resolveRequirement(requirement:Requirement,context:AgentContext){
    const direct=await this.requirements.resolve(requirement,context);
    if(direct.resolved) return direct;
    const provider=this.capabilities.list().find(c=>
      (c.metadata?.provides as string[]|undefined)?.includes(requirement.semanticType)
    );
    if(!provider) return direct;
    const value=await this.execute(provider,{},context);
    return {resolved:true,value,source:'capability-provider',capabilityId:provider.id};
  }

  async continueTask(message:string,taskId:string,runtime:RuntimeContext){
    const task=this.tasks.get(taskId);
    if(!task) throw new Error(`Unknown semantic task: ${taskId}`);
    if(task.context.contextId && task.context.contextId!==runtime.sessionId)
      throw new Error('SEMANTIC_CONTEXT_MISMATCH');
    const requirement=task.context.requirements.find(r=>r.required&&r.value===undefined);
    if(requirement){
      const schema=(requirement.constraints?.schema as any)??{type:'string'};
      const resolved=await resolveSemanticInput({
        input:message,
        schema,
        context:{application:runtime.applicationId,semanticType:requirement.semanticType,description:requirement.description}
      });
      if(resolved.status!=='resolved') return {task,status:'input-required' as const,requirements:[requirement],clarification:resolved.clarification};
      requirement.value=resolved.value;
    }
    task.status='submitted';
    return this.handleTask(task,runtime);
  }

  async handle(request:string,runtime:RuntimeContext){
    const task=this.createTask(request,undefined,runtime.sessionId);
    await this.conversationStore?.append(runtime.sessionId,{id:crypto.randomUUID(),role:'user',content:request,taskId:task.id,createdAt:new Date().toISOString()});
    const context=await this.buildContext(runtime,task.id);
    const plan=await this.plan(request,context);
    task.context.intent=plan.intent;
    if(plan.requirements?.length) task.context.requirements.push(...plan.requirements);
    const plannedInput=plan.nodes[0]?.input;
    if(plannedInput&&typeof plannedInput==='object') for(const requirement of task.context.requirements){
      const field=requirement.sourceField;
      if(field && Object.prototype.hasOwnProperty.call(plannedInput,field)) requirement.value=(plannedInput as Record<string,unknown>)[field];
    }

    for(const requirement of task.context.requirements){
      if(!requirement.required || requirement.value!==undefined) continue;
      const resolved=await this.resolveRequirement(requirement,context);
      if(resolved.resolved){requirement.value=resolved.value;continue;}
      this.tasks.addRequirement(task.id,requirement);
      const pending={task:this.tasks.get(task.id)!,status:'input-required' as const,requirements:[requirement]};
      await this.conversationStore?.append(runtime.sessionId,{id:crypto.randomUUID(),role:'agent',content:requirement.description,taskId:task.id,createdAt:new Date().toISOString()});
      return pending;
    }

    const result=await this.handleTask(task,runtime,plan);
    await this.conversationStore?.append(runtime.sessionId,{id:crypto.randomUUID(),role:'agent',content:result.status==='completed'?'Task completed.':result.status==='failed'?`Task failed: ${result.error}`:'Input required.',taskId:task.id,createdAt:new Date().toISOString()});
    return result;
  }

  private async handleTask(task:any,runtime:RuntimeContext,planned?:SemanticPlan){
    const context=await this.buildContext(runtime,task.id);
    const plan=planned??await this.plan(task.request,context);
    this.tasks.transition(task.id,'working');
    const graph=this.graphs.create(task.id,plan.nodes);
    const outputs:unknown[]=[];
    try{
      while(true){
        const ready=this.graphs.ready(graph.id);
        if(!ready.length) break;
        await Promise.all(ready.map(async node=>{
          const capability=this.capabilities.get(node.capabilityId);
          if(!capability) throw new Error(`Unknown capability: ${node.capabilityId}`);
          const input=this.resolveInput(node.input,task.context.requirements);
          const value=await this.execute(capability,input,context);
          outputs.push(value);
          this.graphs.transition(graph.id,node.id,'completed');
        }));
      }
      if(graph.nodes.some(n=>n.status!=='completed')) throw new Error('TASK_GRAPH_STALLED');
      task.result=outputs.length===1?outputs[0]:outputs;
      this.tasks.transition(task.id,'completed');
      return {task:this.tasks.get(task.id)!,status:'completed' as const,output:outputs};
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      task.error=message; this.tasks.transition(task.id,'failed');
      return {task:this.tasks.get(task.id)!,status:'failed' as const,error:message};
    }
  }

  async conversationHistory(sessionId:string){return (await this.conversationStore?.list(sessionId))??[];}

  manifest():SemanticApplicationManifest{
    return {
      id:this.options.applicationId,name:this.options.applicationName??this.options.applicationId,
      version:this.options.applicationVersion??'0.0.0',
      capabilities:this.capabilities.list(),
      agents:[...this.agents.values()].map(a=>({...a,capabilityIds:[...a.capabilityIds] }))
    };
  }

  private async plan(request:string,context:AgentContext):Promise<SemanticPlan>{
    if(this.planner) return this.planner.plan(request,context);
    const candidates=this.capabilities.list().filter(c=>c.kind!=='knowledge'&&c.metadata?.category!=='models');
    if(!candidates.length) throw new Error('NO_CAPABILITIES');
    const parts=request.split(/\s+(and then|then|and)\s+/i);
    const requests:string[]=[];const links:string[]=[];
    for(let i=0;i<parts.length;i+=2){if(parts[i]?.trim())requests.push(parts[i].trim());if(parts[i+1])links.push(String(parts[i+1]).toLowerCase());}
    const nodes:Omit<TaskNode,'status'>[]=[];const requirements:Requirement[]=[];
    for(let i=0;i<requests.length;i++){
      const part=requests[i];
      const ranked=await rankSemanticInputCandidates(part,candidates.map(c=>c.name+': '+c.description),'fast');
      const selected=candidates.find(c=>c.name+': '+c.description===ranked[0]?.value)??candidates[0];
      let input:unknown={};
      if(selected.inputSchema?.type){
        const resolved=await resolveSemanticInput({input:part,schema:selected.inputSchema as any,context:{application:context.runtime.applicationId,locale:context.runtime.locale}});
        if(resolved.status==='resolved') input=resolved.value;
        else if(resolved.status==='ambiguous'&&resolved.clarification) throw new Error(resolved.clarification.question);
      }
      const id=selected.id+'-'+i;
      const dependsOn=i>0&&links[i-1]==='then'?[nodes[i-1].id]:[];
      nodes.push({id,capabilityId:selected.id,dependsOn,input});
      for(const requirement of selected.requirements??[]) if(requirement.required&&!requirements.some(item=>item.id===requirement.id&&item.sourceCapability===selected.id))
        requirements.push({id:requirement.id,semanticType:requirement.semanticType,description:requirement.description,required:true,sourceCapability:selected.id,sourceField:requirement.sourceField});
    }
    return {intent:nodes.map(n=>n.capabilityId).join(' -> '),nodes,requirements};
  }

  async execute(capability:CapabilityDescriptor,input:unknown,context:AgentContext):Promise<unknown>{
    const execute=async()=>{if(this.executor)return this.executor.execute(capability,input,context);
    if(capability.kind==='gutts') return executeGuttsApi(String(capability.metadata?.apiId??capability.id),input as Record<string,unknown>);
    if(capability.metadata?.service && capability.metadata?.operation)
      return skipoExecutionEngine.executeService(String(capability.metadata.service),String(capability.metadata.operation),input);
    if(capability.kind==='fod-flow' && capability.metadata?.flowExecutor)
      return (capability.metadata.flowExecutor as (input:unknown)=>Promise<unknown>)(input);
    throw new Error(`NO_EXECUTOR:${capability.id}`);};
    return (await new CapabilityExecutionRuntime(this.authorizationPolicy).execute(capability,input,context,{execute})).artifact.value;
  }

  private resolveInput(input:unknown,requirements:Requirement[]):unknown{
    const values=new Map(requirements.map(r=>[r.id,r.value]));
    const visit=(value:unknown):unknown=>{
      if(typeof value==='string'&&value.startsWith('$requirement:')) return values.get(value.slice(13));
      if(Array.isArray(value)) return value.map(visit);
      if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
      return value;
    };
    return visit(input);
  }
}

export function createSkipoSemanticRuntime(options:SemanticRuntimeOptions):SkipoSemanticRuntime{
  return new SkipoSemanticRuntime(options);
}

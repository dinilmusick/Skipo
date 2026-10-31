import {
  CapabilityExecutionRuntime,
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
} from '@ultrst-armada/kloks/semantic-runtime';
import {guttsApiDefinitions,executeGuttsApi,resolveSemanticInput,rankSemanticInputCandidates} from '@dinilmusick/gutts';
import {skipoExecutionEngine} from '../execution/SkipoExecutionEngine.js';

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
  readonly tasks=new TaskRuntime();
  readonly graphs=new TaskGraphRuntime();
  readonly contextResolver:ContextResolver;
  readonly requirements:RequirementResolver;
  readonly agents=new Map<string,SemanticAgentDescriptor>();
  private executor?:SemanticRuntimeExecutor;
  private planner?:SemanticPlanner;

  constructor(private readonly options:SemanticRuntimeOptions){
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
        metadata:{service:serviceName,operation}
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
        metadata:{apiId:api.id,category:api.category,deterministic:api.semantics.deterministic,pure:api.semantics.pure}
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
    const context=await this.buildContext(runtime,task.id);
    const plan=await this.plan(request,context);
    task.context.intent=plan.intent;
    if(plan.requirements?.length) task.context.requirements.push(...plan.requirements);

    for(const requirement of task.context.requirements){
      if(!requirement.required || requirement.value!==undefined) continue;
      const resolved=await this.resolveRequirement(requirement,context);
      if(resolved.resolved){requirement.value=resolved.value;continue;}
      this.tasks.addRequirement(task.id,requirement);
      return {task:this.tasks.get(task.id)!,status:'input-required' as const,requirements:[requirement]};
    }

    return this.handleTask(task,runtime,plan);
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
    const candidates=this.capabilities.list().filter(c=>c.kind!=='knowledge');
    if(!candidates.length) throw new Error('NO_CAPABILITIES');
    const ranked=await rankSemanticInputCandidates(
      request,candidates.map(c=>`${c.name}: ${c.description}`),'fast'
    );
    const selected=candidates.find(c=>`${c.name}: ${c.description}`===ranked[0]?.value)??candidates[0];
    let input:unknown={};
    if(selected.inputSchema?.type){
      const resolved=await resolveSemanticInput({input:request,schema:selected.inputSchema as any,context:{application:context.runtime.applicationId,locale:context.runtime.locale}});
      if(resolved.status==='resolved') input=resolved.value;
      else if(resolved.status==='ambiguous' && resolved.clarification)
        throw new Error(resolved.clarification.question);
    }
    const requirements=(selected.requirements??[]).filter(r=>r.required).map(r=>({
      id:r.id,semanticType:r.semanticType,description:r.description,required:true,
      sourceCapability:selected.id,sourceField:r.sourceField
    }));
    return {intent:selected.id,nodes:[{id:`${selected.id}-0`,capabilityId:selected.id,dependsOn:[],input}],requirements};
  }

  private async execute(capability:CapabilityDescriptor,input:unknown,context:AgentContext):Promise<unknown>{
    if(this.executor) return this.executor.execute(capability,input,context);
    if(capability.kind==='gutts') return executeGuttsApi(String(capability.metadata?.apiId??capability.id),input as Record<string,unknown>);
    if(capability.metadata?.service && capability.metadata?.operation)
      return skipoExecutionEngine.executeService(String(capability.metadata.service),String(capability.metadata.operation),input);
    throw new Error(`NO_EXECUTOR:${capability.id}`);
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

import {
  CapabilityRegistry,
  ContextResolver,
  RequirementResolver,
  TaskRuntime,
  type AgentContext,
  type CapabilityDescriptor,
  type RuntimeContext,
  type Requirement,
} from '@ultrst-armada/kloks/semantic-runtime';

export interface SemanticAgentDescriptor {
  id:string;
  name:string;
  role:'application'|'endpoint'|'capability';
  capabilityIds:string[];
}

export interface SemanticApplicationManifest {
  id:string;
  name:string;
  version:string;
  capabilities:CapabilityDescriptor[];
  agents:SemanticAgentDescriptor[];
}

export interface SemanticRuntimeOptions {
  applicationId:string;
  applicationName?:string;
  applicationVersion?:string;
  knowledgeResolver?:ConstructorParameters<typeof ContextResolver>[1];
}

export class SkipoSemanticRuntime {
  readonly capabilities=new CapabilityRegistry();
  readonly tasks=new TaskRuntime();
  readonly contextResolver:ContextResolver;
  readonly requirements:RequirementResolver;
  readonly agents=new Map<string,SemanticAgentDescriptor>();

  constructor(private readonly options:SemanticRuntimeOptions){
    this.contextResolver=new ContextResolver(this.capabilities,options.knowledgeResolver);
    this.requirements=new RequirementResolver(this.capabilities);
    this.agents.set('application',{
      id:'application',name:options.applicationName??options.applicationId,
      role:'application',capabilityIds:[]
    });
  }

  registerCapability(capability:CapabilityDescriptor):void{
    this.capabilities.upsert(capability);
    const agent=this.agents.get('application')!;
    if(!agent.capabilityIds.includes(capability.id)) agent.capabilityIds.push(capability.id);
  }

  registerAgent(agent:SemanticAgentDescriptor):void{
    this.agents.set(agent.id,agent);
  }

  registerService(serviceName:string,service:any):void{
    const operations=service?.definition?.operations??{};
    for(const [operation,definition] of Object.entries<any>(operations)){
      this.registerCapability({
        id:`${serviceName}.${operation}`,
        name:definition.name??operation,
        description:definition.description??`Execute ${operation} on ${serviceName}`,
        kind:'endpoint',
        inputSchema:definition.inputSchema,
        outputSchema:definition.outputSchema,
        metadata:{service:serviceName,operation}
      });
    }
  }

  createTask(request:string,parentTaskId?:string){
    return this.tasks.create(request,parentTaskId);
  }

  async buildContext(runtime:RuntimeContext,taskId:string):Promise<AgentContext>{
    const task=this.tasks.get(taskId);
    if(!task) throw new Error(`Unknown semantic task: ${taskId}`);
    return this.contextResolver.resolve(runtime,task.context);
  }

  async resolveRequirement(requirement:Requirement,context:AgentContext){
    return this.requirements.resolve(requirement,context);
  }

  manifest():SemanticApplicationManifest{
    return {
      id:this.options.applicationId,
      name:this.options.applicationName??this.options.applicationId,
      version:this.options.applicationVersion??'0.0.0',
      capabilities:this.capabilities.list(),
      agents:[...this.agents.values()].map(a=>({...a,capabilityIds:[...a.capabilityIds]}))
    };
  }
}

export function createSkipoSemanticRuntime(options:SemanticRuntimeOptions):SkipoSemanticRuntime{
  return new SkipoSemanticRuntime(options);
}

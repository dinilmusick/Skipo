import { ModuleBackendAdapter } from '../backend/ModuleBackendAdapter.js';
import type { ModuleBackendAuthorization } from '../backend/ModuleBackendAdapterTypes.js';
import { NamespacedModuleEventBus } from './ModuleEventBus.js';
import type { SkipoModuleManifest } from '../module-contract/ModuleTypes.js';
import type { ModuleController, ModuleHostOptions, ModuleRuntimeContext, MountedModule, SkipoModuleRuntimeDefinition, ModuleLifecycleState } from './ModuleRuntimeTypes.js';

const empty = Object.freeze({}) as Readonly<Record<string, unknown>>;
const resource = (v: Readonly<Record<string, unknown>>|undefined) => v ? Object.freeze({...v}) : empty;

function validateDefinition(d: SkipoModuleRuntimeDefinition) {
  if (!d?.manifest?.application?.moduleCapable || !d.manifest.application.standalone) throw new Error('Module must be module-capable and standalone-capable.');
  if (typeof d.mount !== 'function') throw new Error('Module runtime definition requires mount(context).');
  const declared = new Set(d.manifest.capabilities.map(c=>c.id)), seen = new Set<string>();
  for (const b of d.backend?.bindings ?? []) {
    if (seen.has(b.capabilityId)) throw new Error(`Duplicate module backend binding: ${b.capabilityId}`);
    if (!declared.has(b.capabilityId)) throw new Error(`Backend binding '${b.capabilityId}' is not declared in the module manifest.`);
    seen.add(b.capabilityId);
  }
}
export class ModuleHost {
  private readonly backend; private readonly resources; private readonly authorize;
  private readonly definitions = new Map<string, SkipoModuleRuntimeDefinition>();
  private readonly mounted = new Map<string,{definition:SkipoModuleRuntimeDefinition;context:ModuleRuntimeContext;controller?:ModuleController;state:ModuleLifecycleState;abort:AbortController}>();
  constructor(options: ModuleHostOptions) { if (!options?.backend) throw new Error('ModuleHost requires the parent BackendFacade.'); this.backend=options.backend; this.resources=options.resources??{}; this.authorize=options.authorizeCapabilities; }
  discover(definition: SkipoModuleRuntimeDefinition) { validateDefinition(definition); const id=definition.manifest.module.id; if(this.definitions.has(id)) throw new Error(`Module '${id}' is already discovered.`); this.definitions.set(id,definition); return definition.manifest; }
  listDiscovered(){ return Object.freeze([...this.definitions.keys()]); }
  listMounted(){ return Object.freeze([...this.mounted.keys()]); }
  async mount(moduleId:string):Promise<MountedModule>{
    const definition=this.definitions.get(moduleId); if(!definition) throw new Error(`Module '${moduleId}' has not been discovered.`); if(this.mounted.has(moduleId)) throw new Error(`Module '${moduleId}' is already mounted.`);
    const requested=Object.freeze(definition.manifest.capabilities.map(c=>c.id)); const approved=Object.freeze(await this.authorize?.(definition.manifest,requested) ?? []);
    for(const grant of approved) if(grant!=='*'&&!requested.includes(grant)) throw new Error(`Capability authorizer granted undeclared capability '${grant}'.`);
    const bindings=definition.backend?.bindings??[]; const bindingById=new Map(bindings.map(b=>[b.capabilityId,b]));
    const parentIds=new Set(bindings.map(b=>String(b.representation?.parentCapabilityId ?? b.capabilityId)));
    const authorization:ModuleBackendAuthorization={
      canDiscover:({capability})=>{ const id=capability.id; const binding=[...bindingById.values()].find(b=>String(b.representation?.parentCapabilityId??b.capabilityId)===id); return !!binding&&(approved.includes(binding.capabilityId)||approved.includes('*')); },
      canInvoke:({capability})=>{ const id=capability.id; return parentIds.has(id)&&[...bindingById.values()].some(b=>String(b.representation?.parentCapabilityId??b.capabilityId)===id&&(approved.includes(b.capabilityId)||approved.includes('*'))); },
    };
    const abort=new AbortController(), events=new NamespacedModuleEventBus(moduleId);
    const context:ModuleRuntimeContext=Object.freeze({
      moduleId,manifest:definition.manifest,
      backend:new ModuleBackendAdapter({backend:this.backend,manifest:{moduleId,capabilities:bindings.map(b=>({capabilityId:String(b.representation?.parentCapabilityId??b.capabilityId),representation:b.representation,inputMapping:b.inputMapping,outputMapping:b.outputMapping}))},authorization}),
      workspace:resource(this.resources.workspace),auth:resource(this.resources.auth),theme:resource(this.resources.theme),runtime:resource(this.resources.runtime),
      capabilities:new Set(approved),signal:abort.signal,events
    });
    const entry={definition,context,controller:undefined as ModuleController|undefined,state:'mounted' as ModuleLifecycleState,abort};
    try{entry.controller=await definition.mount(context)??undefined;this.mounted.set(moduleId,entry);}catch(e){entry.state='failed';abort.abort();events.clear();throw e;}
    return this.instance(moduleId);
  }
  async activate(id:string){const e=this.require(id);if(e.state==='active')return;if(e.state!=='mounted')throw new Error(`Cannot activate module '${id}' from state '${e.state}'.`);await e.controller?.activate?.();e.state='active';}
  async deactivate(id:string){const e=this.require(id);if(e.state==='mounted')return;if(e.state!=='active')throw new Error(`Cannot deactivate module '${id}' from state '${e.state}'.`);e.state='deactivating';try{await e.controller?.deactivate?.();e.state='mounted';}catch(err){e.state='active';throw err;}}
  async unmount(id:string){const e=this.mounted.get(id);if(!e)return;if(e.state==='active')await this.deactivate(id);e.state='unmounting';try{await e.controller?.unmount?.();}finally{e.abort.abort();e.context.events.clear();e.state='unmounted';this.mounted.delete(id);}}
  async dispose(id:string){const e=this.mounted.get(id);if(!e)return;try{if(e.state==='active')await this.deactivate(id);if(e.state!=='unmounted')await e.controller?.unmount?.();await e.controller?.dispose?.();}finally{e.abort.abort();e.context.events.clear();e.state='disposed';this.mounted.delete(id);}}
  private instance(id:string):MountedModule{const e=this.require(id);return {moduleId:id,context:e.context,get state(){return e.state;},activate:()=>this.activate(id),deactivate:()=>this.deactivate(id),unmount:()=>this.unmount(id),dispose:()=>this.dispose(id)};}
  private require(id:string){const e=this.mounted.get(id);if(!e)throw new Error(`Module '${id}' is not mounted.`);return e;}
}

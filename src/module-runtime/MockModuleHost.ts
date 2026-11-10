import type { IBackendFacade } from '../backend/BackendFacadeTypes.js'; import { ModuleHost } from './ModuleHost.js'; import type { ModuleHostOptions } from './ModuleRuntimeTypes.js';
export interface MockBackend extends IBackendFacade { registerMockCapability(id:string,handler:(input:unknown)=>unknown|Promise<unknown>):void; }
export function createMockBackendFacade():MockBackend{
 const handlers=new Map<string,(input:unknown)=>unknown|Promise<unknown>>();
 const backend={
  namespaces:{},libraries:{},functionalities:{},orchestrations:{},registerService(){return backend},
  getLibrary(){throw new Error('Mock backend library access is not exposed.')},getFunctionality(){throw new Error('Mock backend functionality access is not exposed.')},getOrchestration(){throw new Error('Mock backend orchestration access is not exposed.')},
  async executeCapability(name:string,_op?:string,input?:unknown,options?:{serviceId?:string}){const id=options?.serviceId?`${options.serviceId}/functionalities/${name}`:name;const h=handlers.get(id)??handlers.get(name);if(!h)throw new Error(`Mock capability not found: ${id}`);return h(input)},
  getService(){throw new Error('Mock backend service access is not exposed.')},hasCapability(n:string){return handlers.has(n)},listServices(){return []},listCapabilities(){return Object.freeze([...handlers.keys()].map(id=>({id,name:id.split('/').pop()??id,serviceId:id.split('/')[0]??id,serviceName:id.split('/')[0]??id,serviceVersion:'test',category:'functionalities' as const,description:id,invocation:{kind:'functionality' as const,operation:id.split('/').pop()??id},capabilities:[],protocols:['http','mcp']})))},registerMockCapability(id:string,h:(input:unknown)=>unknown|Promise<unknown>){handlers.set(id,h)}
 } as MockBackend; return backend;
}
export function createMockModuleHost(options:Omit<Partial<ModuleHostOptions>,'backend'>&{backend?:IBackendFacade}={}){const backend=options.backend??createMockBackendFacade();return {backend,host:new ModuleHost({backend,resources:options.resources,hostId:options.hostId??'mock-module-host',authorizeCapabilities:options.authorizeCapabilities??((_m,r)=>r})};}

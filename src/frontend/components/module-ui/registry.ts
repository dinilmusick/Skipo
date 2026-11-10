import type { SkipoModuleUIContribution, ModuleUIExport } from './contract.js';
const SURFACES=new Set(['floating-panel','overlay','drawer','full-screen']);
export class ModuleUIRegistry{
 private readonly entries=new Map<string,SkipoModuleUIContribution>(); private readonly listeners=new Set<()=>void>();
 register(c:SkipoModuleUIContribution){if(!c.moduleId||this.entries.has(c.moduleId))throw new Error(`Module UI '${c.moduleId}' already registered.`);const seen=new Set<string>();for(const e of c.exports){if(!e.id||seen.has(e.id))throw new Error('Duplicate module UI export.');if(!SURFACES.has(e.surfaceType))throw new Error(`unsupported module UI surface: ${e.surfaceType}`);seen.add(e.id);}this.entries.set(c.moduleId,Object.freeze({moduleId:c.moduleId,exports:Object.freeze(c.exports.map(e=>Object.freeze({...e}))) }));this.emit();return()=>{this.entries.delete(c.moduleId);this.emit();};}
 getSnapshot(){return Object.freeze([...this.entries.values()]);} subscribe(l:()=>void){this.listeners.add(l);return()=>this.listeners.delete(l);} private emit(){for(const l of this.listeners)l();}
}
export const skipoModuleUIRegistry=new ModuleUIRegistry();
export function registerSkipoModuleUI(c:SkipoModuleUIContribution){return skipoModuleUIRegistry.register(c);}

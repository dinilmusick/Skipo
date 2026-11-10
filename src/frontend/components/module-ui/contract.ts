import type { ComponentType } from 'react';
export type ModuleSurfaceType='floating-panel'|'overlay'|'drawer'|'full-screen';
export interface ModuleSurfaceProps{open:boolean;onRequestClose:()=>void;}
export interface ModuleUIExport{ id:string; label:string; icon?:string; component:ComponentType<ModuleSurfaceProps>; surfaceType:ModuleSurfaceType; metadata?:Readonly<Record<string,unknown>>; }
export interface SkipoModuleUIContribution{moduleId:string;exports:readonly ModuleUIExport[];}

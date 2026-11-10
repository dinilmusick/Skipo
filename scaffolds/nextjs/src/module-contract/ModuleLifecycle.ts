import type { ModuleLifecyclePhase, SkipoModuleManifest } from './ModuleTypes.js';

/** Host-neutral lifecycle context. It deliberately exposes no host runtime implementation. */
export interface ModuleLifecycleContext {
  readonly moduleId: string;
  readonly execution: 'standalone' | 'embedded';
  readonly apiBaseRoute: string;
  readonly parentResources: Readonly<Record<string, unknown>>;
}
export interface SkipoModuleLifecycle {
  readonly manifest: SkipoModuleManifest;
  validate?(context: ModuleLifecycleContext): Promise<void> | void;
  initialize?(context: ModuleLifecycleContext): Promise<void> | void;
  start?(context: ModuleLifecycleContext): Promise<void> | void;
  stop?(context: ModuleLifecycleContext): Promise<void> | void;
  dispose?(context: ModuleLifecycleContext): Promise<void> | void;
}
export const MODULE_LIFECYCLE_PHASES: readonly ModuleLifecyclePhase[] =
  ['validate', 'initialize', 'start', 'stop', 'dispose'];

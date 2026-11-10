import type { ModuleBackendAdapter, ModuleBackendAuthorization, ModuleBackendManifest } from '../backend/ModuleBackendAdapter.js';
import type { SkipoModuleManifest } from '../module-contract/ModuleTypes.js';
import type { IBackendFacade } from '../backend/BackendFacadeTypes.js';

export interface ModuleParentResources {
  readonly workspace?: Readonly<Record<string, unknown>>;
  readonly auth?: Readonly<Record<string, unknown>>;
  readonly theme?: Readonly<Record<string, unknown>>;
  readonly runtime?: Readonly<Record<string, unknown>>;
}
export interface ModuleCapabilityBinding {
  readonly capabilityId: string;
  readonly representation?: Readonly<Record<string, unknown>>;
  readonly inputMapping?: Readonly<Record<string, string>>;
  readonly outputMapping?: Readonly<Record<string, string>>;
}
export interface SkipoModuleRuntimeDefinition {
  readonly manifest: SkipoModuleManifest;
  readonly backend?: { readonly bindings: readonly ModuleCapabilityBinding[] };
  mount(context: ModuleRuntimeContext): Promise<ModuleController | void> | ModuleController | void;
}
export interface ModuleRuntimeContext {
  readonly moduleId: string;
  readonly manifest: SkipoModuleManifest;
  readonly backend: ModuleBackendAdapter;
  readonly workspace: Readonly<Record<string, unknown>>;
  readonly auth: Readonly<Record<string, unknown>>;
  readonly theme: Readonly<Record<string, unknown>>;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly capabilities: ReadonlySet<string>;
  readonly signal: AbortSignal;
  readonly events: ModuleEventBus;
}
export interface ModuleController {
  activate?(): Promise<void> | void;
  deactivate?(): Promise<void> | void;
  unmount?(): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
export interface ModuleEventBus {
  readonly namespace: string;
  on<T>(event: string, listener: (payload: T) => void): () => void;
  emit<T>(event: string, payload: T): void;
  clear(): void;
}
export interface ModuleHostOptions {
  readonly backend: IBackendFacade;
  readonly resources?: ModuleParentResources;
  readonly hostId?: string;
  readonly authorizeCapabilities?: (module: SkipoModuleManifest, requested: readonly string[]) => readonly string[] | Promise<readonly string[]>;
}
export interface MountedModule {
  readonly moduleId: string;
  readonly state: ModuleLifecycleState;
  readonly context: ModuleRuntimeContext;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  unmount(): Promise<void>;
  dispose(): Promise<void>;
}
export type ModuleLifecycleState = 'mounted'|'active'|'deactivating'|'unmounting'|'unmounted'|'disposed'|'failed';

export function toBackendManifest(moduleId: string, bindings: readonly ModuleCapabilityBinding[]): ModuleBackendManifest {
  return Object.freeze({ moduleId, capabilities: Object.freeze(bindings.map(b => Object.freeze({
    capabilityId: String(b.representation?.parentCapabilityId ?? b.capabilityId),
    representation: b.representation, inputMapping: b.inputMapping, outputMapping: b.outputMapping,
  }))) });
}

import type {
  IBackendFacade,
  CrossServiceExecutionOptions
} from '../../backend/BackendFacadeTypes.js';
import type { ModuleLifecycleContext } from './ModuleLifecycle.js';
import type { ModuleMetadata } from './ModuleManifest.js';

export type ModuleResourceContext = Readonly<Record<string, unknown>>;

export interface ModuleCapabilityAccess {
  readonly approved: readonly string[];
  has(capability: string): boolean;
  assert(capability: string): void;
}

export interface ModuleBackendAccess {
  getLibrary<T = unknown>(name: string, serviceNamespace?: string): T;
  getFunctionality<T = unknown>(name: string, serviceNamespace?: string): T;
  getOrchestration<T = unknown>(name: string, serviceNamespace?: string): T;
  executeCapability<TIn = unknown, TOut = unknown>(
    capabilityName: string,
    operation?: string,
    input?: TIn,
    options?: CrossServiceExecutionOptions
  ): Promise<TOut>;
  hasCapability(
    name: string,
    category?: 'libraries' | 'functionalities' | 'orchestrations'
  ): boolean;
}

export interface ModuleEventBus {
  readonly namespace: string;
  emit<T = unknown>(event: string, payload: T): void;
  on<T = unknown>(event: string, listener: (payload: T) => void): () => void;
  clear(): void;
}

export interface ModuleContext {
  readonly metadata: ModuleMetadata;
  readonly backend: ModuleBackendAccess;
  readonly workspace: ModuleResourceContext;
  readonly authentication: ModuleResourceContext;
  readonly theme: ModuleResourceContext;
  readonly runtime: ModuleResourceContext;
  readonly capabilities: ModuleCapabilityAccess;
  readonly events: ModuleEventBus;
  readonly lifecycle: ModuleLifecycleContext;
}

export interface ModuleParentContext {
  readonly backend: IBackendFacade;
  readonly workspace?: ModuleResourceContext;
  readonly authentication?: ModuleResourceContext;
  readonly theme?: ModuleResourceContext;
  readonly runtime?: ModuleResourceContext;
  readonly hostId?: string;
  authorizeCapabilities?(
    module: ModuleMetadata,
    requested: readonly string[]
  ): readonly string[] | Promise<readonly string[]>;
}

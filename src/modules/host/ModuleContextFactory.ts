import type {
  ModuleBackendAccess,
  ModuleContext,
  ModuleParentContext
} from '../contracts/ModuleContext.js';
import type {
  ModuleLifecycleContext,
  ModuleLifecycleState
} from '../contracts/ModuleLifecycle.js';
import type {
  ModuleManifest,
  ModuleMetadata
} from '../contracts/ModuleManifest.js';
import { NamespacedModuleEventBus } from '../isolation/ModuleEventBus.js';

const EMPTY_RESOURCE = Object.freeze({}) as Readonly<Record<string, unknown>>;

function freezeResource(
  value: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> {
  return value ? Object.freeze({ ...value }) : EMPTY_RESOURCE;
}

function createCapabilityAccess(approved: readonly string[]) {
  const grants = new Set(approved);
  return Object.freeze({
    approved: Object.freeze([...grants]),
    has: (capability: string) =>
      grants.has(capability) || grants.has('*'),
    assert: (capability: string) => {
      if (!grants.has(capability) && !grants.has('*')) {
        throw new Error(`Module capability denied: ${capability}`);
      }
    }
  });
}

function createBackendAccess(
  backend: ModuleParentContext['backend'],
  capabilities: ReturnType<typeof createCapabilityAccess>
): ModuleBackendAccess {
  const require = (capability: string) => capabilities.assert(capability);
  return Object.freeze({
    getLibrary<T = unknown>(name: string, serviceNamespace?: string): T {
      require(`backend.library:${name}`);
      return backend.getLibrary<T>(name, serviceNamespace);
    },
    getFunctionality<T = unknown>(
      name: string,
      serviceNamespace?: string
    ): T {
      require(`backend.functionality:${name}`);
      return backend.getFunctionality<T>(name, serviceNamespace);
    },
    getOrchestration<T = unknown>(
      name: string,
      serviceNamespace?: string
    ): T {
      require(`backend.orchestration:${name}`);
      return backend.getOrchestration<T>(name, serviceNamespace);
    },
    executeCapability<TIn = unknown, TOut = unknown>(
      capabilityName: string,
      operation?: string,
      input?: TIn,
      options?: import('../../backend/BackendFacadeTypes.js')
        .CrossServiceExecutionOptions
    ): Promise<TOut> {
      require(`backend.execute:${capabilityName}`);
      return backend.executeCapability<TIn, TOut>(
        capabilityName,
        operation,
        input,
        options
      );
    },
    hasCapability(
      name: string,
      category?: 'libraries' | 'functionalities' | 'orchestrations'
    ): boolean {
      const singular = {
        libraries: 'library',
        functionalities: 'functionality',
        orchestrations: 'orchestration'
      } as const;
      const categories = category ? [category] :
        Object.keys(singular) as Array<keyof typeof singular>;
      return categories.some((item) =>
        capabilities.has(`backend.${singular[item]}:${name}`) &&
        backend.hasCapability(name, item)
      );
    }
  });
}

export interface ModuleContextFactoryInput {
  readonly parent: ModuleParentContext;
  readonly manifest: ModuleManifest;
  readonly instanceId: string;
  readonly getState: () => ModuleLifecycleState;
  readonly signal: AbortSignal;
  readonly approvedCapabilities: readonly string[];
}

export function createModuleContext(
  input: ModuleContextFactoryInput
): ModuleContext {
  const hostId = input.parent.hostId ?? 'skipo-module-host';
  const metadata: ModuleMetadata = Object.freeze({
    ...input.manifest,
    dependencies: input.manifest.dependencies
      ? Object.freeze([...input.manifest.dependencies])
      : undefined,
    capabilities: input.manifest.capabilities
      ? Object.freeze([...input.manifest.capabilities])
      : undefined,
    metadata: input.manifest.metadata
      ? Object.freeze({ ...input.manifest.metadata })
      : undefined,
    hostId,
    instanceId: input.instanceId
  });
  const capabilities = createCapabilityAccess(input.approvedCapabilities);
  const lifecycle: ModuleLifecycleContext = Object.freeze({
    signal: input.signal,
    getState: input.getState
  });

  return Object.freeze({
    metadata,
    backend: createBackendAccess(input.parent.backend, capabilities),
    workspace: freezeResource(input.parent.workspace),
    authentication: freezeResource(input.parent.authentication),
    theme: freezeResource(input.parent.theme),
    runtime: freezeResource(input.parent.runtime),
    capabilities,
    events: new NamespacedModuleEventBus(input.instanceId),
    lifecycle
  });
}

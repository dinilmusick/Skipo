import type {
  ModuleContext,
  ModuleParentContext
} from '../contracts/ModuleContext.js';
import type {
  ModuleInstance,
  ModuleLifecycleSnapshot,
  ModuleLifecycleState
} from '../contracts/ModuleLifecycle.js';
import type { ModuleDefinition } from '../contracts/ModuleDefinition.js';
import type {
  ModuleManifest,
  ModuleMetadata
} from '../contracts/ModuleManifest.js';
import { createModuleContext } from './ModuleContextFactory.js';
import { validateModule } from './ModuleValidator.js';

export interface ModuleHostOptions {
  readonly parent: ModuleParentContext;
  readonly hostId?: string;
}

interface InternalInstance {
  readonly id: string;
  readonly context: ModuleContext;
  readonly abortController: AbortController;
  readonly mountedAt: number;
  readonly lifecycleState: { value: ModuleLifecycleState };
  controller?: import('../contracts/ModuleLifecycle.js').ModuleController;
  state: ModuleLifecycleState;
  publicInstance: ModuleInstance;
}

export class ModuleHostError extends Error {
  readonly moduleId: string;
  readonly operation: string;

  constructor(moduleId: string, operation: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Module '${moduleId}' failed during ${operation}: ${detail}`);
    this.name = 'ModuleHostError';
    this.moduleId = moduleId;
    this.operation = operation;
    if (cause instanceof Error) this.cause = cause;
  }
}

let generatedHostSequence = 0;

export class ModuleHost {
  readonly id: string;
  private readonly parent: ModuleParentContext;
  private readonly definitions = new Map<string, ModuleDefinition>();
  private readonly instances = new Map<string, InternalInstance>();

  constructor(options: ModuleHostOptions) {
    if (!options?.parent?.backend) {
      throw new Error('ModuleHost requires a parent BackendFacade.');
    }
    generatedHostSequence += 1;
    this.id = options.hostId ?? options.parent.hostId ??
      `skipo-module-host-${generatedHostSequence}`;
    this.parent = Object.freeze({
      ...options.parent,
      hostId: this.id
    });
  }

  discover(value: unknown): ModuleManifest {
    const definition = validateModule(value);
    const id = definition.manifest.id;
    if (this.definitions.has(id)) {
      throw new Error(`Module '${id}' has already been discovered.`);
    }
    if (this.instances.has(id)) {
      throw new Error(`Module '${id}' is already mounted.`);
    }
    const manifest = Object.freeze({
      ...definition.manifest,
      dependencies: definition.manifest.dependencies
        ? Object.freeze([...definition.manifest.dependencies])
        : undefined,
      capabilities: definition.manifest.capabilities
        ? Object.freeze([...definition.manifest.capabilities])
        : undefined,
      metadata: definition.manifest.metadata
        ? Object.freeze({ ...definition.manifest.metadata })
        : undefined
    });
    const registered = Object.freeze({
      manifest,
      mount: definition.mount
    });
    this.definitions.set(id, registered);
    return manifest;
  }

  listDiscovered(): readonly string[] {
    return Object.freeze([...this.definitions.keys()]);
  }

  listMounted(): readonly ModuleLifecycleSnapshot[] {
    return Object.freeze([...this.instances.values()].map((instance) =>
      Object.freeze({
        id: instance.id,
        state: instance.state,
        mountedAt: instance.mountedAt
      })
    ));
  }

  getInstance(moduleId: string): ModuleInstance {
    const instance = this.instances.get(moduleId);
    if (!instance) throw new Error(`Module '${moduleId}' is not mounted.`);
    return instance.publicInstance;
  }

  async mount(moduleId: string): Promise<ModuleInstance> {
    const definition = this.definitions.get(moduleId);
    if (!definition) throw new Error(`Module '${moduleId}' has not been discovered.`);
    if (this.instances.has(moduleId)) {
      throw new Error(`Module '${moduleId}' is already mounted.`);
    }

    const requested = Object.freeze([...(definition.manifest.capabilities ?? [])]);
    const instanceId = `${this.id}/${moduleId}`;
    const metadata: ModuleMetadata = Object.freeze({
      ...definition.manifest,
      hostId: this.id,
      instanceId
    });
    let approved: readonly string[] = [];
    try {
      approved = this.parent.authorizeCapabilities
        ? await this.parent.authorizeCapabilities(metadata, requested)
        : [];
      if (!Array.isArray(approved) ||
          approved.some((grant) => typeof grant !== 'string' ||
            (!requested.includes(grant) && grant !== '*'))) {
        throw new Error('Capability authorizer returned an unrequested grant.');
      }
      if (approved.includes('*') && !requested.includes('*')) {
        throw new Error('Wildcard capability grants require an explicit wildcard request.');
      }
    } catch (error) {
      throw new ModuleHostError(moduleId, 'capability authorization', error);
    }

    const abortController = new AbortController();
    const lifecycleState = { value: 'mounting' as ModuleLifecycleState };
    const context = createModuleContext({
      parent: this.parent,
      manifest: definition.manifest,
      instanceId,
      getState: () => lifecycleState.value,
      signal: abortController.signal,
      approvedCapabilities: approved
    });
    const internal: InternalInstance = {
      id: moduleId,
      context,
      abortController,
      mountedAt: Date.now(),
      lifecycleState,
      get state() {
        return lifecycleState.value;
      },
      set state(value: ModuleLifecycleState) {
        lifecycleState.value = value;
      },
      publicInstance: undefined as unknown as ModuleInstance
    };
    const publicInstance: ModuleInstance = {
      id: moduleId,
      context,
      get state() {
        return internal.state;
      },
      activate: () => this.activate(moduleId),
      deactivate: () => this.deactivate(moduleId),
      unmount: () => this.unmount(moduleId)
    };
    internal.publicInstance = publicInstance;

    try {
      internal.controller = await definition.mount(context) ?? undefined;
      internal.state = 'mounted';
      this.instances.set(moduleId, internal);
      return publicInstance;
    } catch (error) {
      internal.state = 'failed';
      abortController.abort();
      context.events.clear();
      throw new ModuleHostError(moduleId, 'mounting', error);
    }
  }

  async activate(moduleId: string): Promise<void> {
    const instance = this.requireInstance(moduleId);
    if (instance.state === 'active') return;
    if (instance.state !== 'mounted') {
      throw new Error(`Cannot activate '${moduleId}' from state '${instance.state}'.`);
    }
    instance.state = 'activating';
    try {
      await instance.controller?.activate?.();
      instance.state = 'active';
    } catch (error) {
      instance.state = 'mounted';
      throw new ModuleHostError(moduleId, 'activation', error);
    }
  }

  async deactivate(moduleId: string): Promise<void> {
    const instance = this.requireInstance(moduleId);
    if (instance.state === 'mounted') return;
    if (instance.state !== 'active') {
      throw new Error(`Cannot deactivate '${moduleId}' from state '${instance.state}'.`);
    }
    instance.state = 'deactivating';
    try {
      await instance.controller?.deactivate?.();
      instance.state = 'mounted';
    } catch (error) {
      instance.state = 'active';
      throw new ModuleHostError(moduleId, 'deactivation', error);
    }
  }

  async unmount(moduleId: string): Promise<void> {
    const instance = this.instances.get(moduleId);
    if (!instance) return;
    const errors: unknown[] = [];
    if (instance.state === 'active') {
      try {
        await this.deactivate(moduleId);
      } catch (error) {
        errors.push(error);
      }
    }
    instance.state = 'unmounting';
    try {
      await instance.controller?.unmount?.();
    } catch (error) {
      errors.push(error);
    } finally {
      instance.abortController.abort();
      instance.context.events.clear();
      instance.state = 'unmounted';
      this.instances.delete(moduleId);
    }
    if (errors.length) {
      throw new ModuleHostError(
        moduleId,
        'unmounting',
        new AggregateError(errors, 'Module cleanup encountered errors.')
      );
    }
  }

  async unmountAll(): Promise<void> {
    const failures: unknown[] = [];
    for (const moduleId of [...this.instances.keys()]) {
      try {
        await this.unmount(moduleId);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, 'One or more modules failed to unmount.');
    }
  }

  private requireInstance(moduleId: string): InternalInstance {
    const instance = this.instances.get(moduleId);
    if (!instance) throw new Error(`Module '${moduleId}' is not mounted.`);
    return instance;
  }
}

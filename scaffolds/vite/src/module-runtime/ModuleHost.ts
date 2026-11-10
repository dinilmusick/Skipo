import type { IBackendFacade } from '../../backend/BackendFacadeTypes.js';
import { ModuleBackendAdapter } from '../../backend/ModuleBackendAdapter.js';
import type { ModuleBackendAuthorization } from '../../backend/ModuleBackendAdapterTypes.js';
import type { SkipoModuleManifest } from '../../module-contract/ModuleTypes.js';
import { NamespacedModuleEventBus } from './ModuleEventBus.js';
import {
  toBackendManifest, type ModuleHostOptions, type ModuleRuntimeContext,
  type MountedModule, type SkipoModuleRuntimeDefinition, type ModuleLifecycleState,
} from './ModuleRuntimeTypes.js';

const EMPTY = Object.freeze({}) as Readonly<Record<string, unknown>>;
const resource = (value: Readonly<Record<string, unknown>> | undefined) =>
  value ? Object.freeze({ ...value }) : EMPTY;

function validateDefinition(definition: SkipoModuleRuntimeDefinition): void {
  if (!definition?.manifest?.application?.moduleCapable) throw new Error('Module is not module-capable.');
  if (!definition.manifest.application.standalone) throw new Error('Embedded modules must remain standalone-capable.');
  if (typeof definition.mount !== 'function') throw new Error('Module runtime definition requires mount(context).');
  const declared = new Set(definition.manifest.capabilities.map(capability => capability.id));
  const seen = new Set<string>();
  for (const binding of definition.backend?.bindings ?? []) {
    if (seen.has(binding.capabilityId)) throw new Error(`Duplicate module backend binding: ${binding.capabilityId}`);
    seen.add(binding.capabilityId);
    if (!declared.has(binding.capabilityId)) throw new Error(`Backend binding '${binding.capabilityId}' is not declared in the module manifest.`);
  }
}

export class ModuleHost {
  private readonly backend: IBackendFacade;
  private readonly resources: NonNullable<ModuleHostOptions['resources']>;
  private readonly authorize?: ModuleHostOptions['authorizeCapabilities'];
  private readonly definitions = new Map<string, SkipoModuleRuntimeDefinition>();
  private readonly mounted = new Map<string, {
    definition: SkipoModuleRuntimeDefinition;
    context: ModuleRuntimeContext;
    controller?: import('./ModuleRuntimeTypes.js').ModuleController;
    state: ModuleLifecycleState;
    abort: AbortController;
  }>();

  constructor(options: ModuleHostOptions) {
    if (!options?.backend) throw new Error('ModuleHost requires the parent BackendFacade.');
    this.backend = options.backend;
    this.resources = options.resources ?? {};
    this.authorize = options.authorizeCapabilities;
  }

  discover(definition: SkipoModuleRuntimeDefinition): SkipoModuleManifest {
    validateDefinition(definition);
    const id = definition.manifest.module.id;
    if (this.definitions.has(id)) throw new Error(`Module '${id}' is already discovered.`);
    this.definitions.set(id, definition);
    return definition.manifest;
  }

  listDiscovered(): readonly string[] { return Object.freeze([...this.definitions.keys()]); }
  listMounted(): readonly string[] { return Object.freeze([...this.mounted.keys()]); }

  async mount(moduleId: string): Promise<MountedModule> {
    const definition = this.definitions.get(moduleId);
    if (!definition) throw new Error(`Module '${moduleId}' has not been discovered.`);
    if (this.mounted.has(moduleId)) throw new Error(`Module '${moduleId}' is already mounted.`);

    const requested = Object.freeze(definition.manifest.capabilities.map(capability => capability.id));
    const approved = Object.freeze(await this.authorize?.(definition.manifest, requested) ?? []);
    for (const grant of approved) {
      if (grant !== '*' && !requested.includes(grant)) throw new Error(`Capability authorizer granted undeclared capability '${grant}'.`);
    }

    const bindings = definition.backend?.bindings ?? [];
    const bindingByModuleId = new Map(bindings.map(binding => [binding.capabilityId, binding]));
    const adapterManifest = toBackendManifest(moduleId, bindings);
    const authorization: ModuleBackendAuthorization = {
      canDiscover: ({ capability }) => {
        const binding = [...bindingByModuleId.values()].find(candidate =>
          String(candidate.representation?.parentCapabilityId ?? candidate.capabilityId) === capability.id);
        return Boolean(binding && (approved.includes(binding.capabilityId) || approved.includes('*')));
      },
      canInvoke: ({ capability }) => {
        const binding = [...bindingByModuleId.values()].find(candidate =>
          String(candidate.representation?.parentCapabilityId ?? candidate.capabilityId) === capability.id);
        return Boolean(binding && (approved.includes(binding.capabilityId) || approved.includes('*')));
      },
    };

    const abort = new AbortController();
    const events = new NamespacedModuleEventBus(moduleId);
    const context: ModuleRuntimeContext = Object.freeze({
      moduleId, manifest: definition.manifest,
      backend: new ModuleBackendAdapter({ backend: this.backend, manifest: adapterManifest, authorization }),
      workspace: resource(this.resources.workspace),
      auth: resource(this.resources.auth),
      theme: resource(this.resources.theme),
      runtime: resource(this.resources.runtime),
      capabilities: new Set(approved),
      signal: abort.signal, events,
    });

    const entry = {
      definition, context, state: 'mounted' as ModuleLifecycleState, abort,
      controller: undefined as import('./ModuleRuntimeTypes.js').ModuleController | undefined,
    };
    try {
      entry.controller = await definition.mount(context) ?? undefined;
      this.mounted.set(moduleId, entry);
    } catch (error) {
      entry.state = 'failed'; abort.abort(); events.clear(); throw error;
    }
    return this.instance(moduleId);
  }

  async activate(moduleId: string): Promise<void> {
    const entry = this.require(moduleId);
    if (entry.state === 'active') return;
    if (entry.state !== 'mounted') throw new Error(`Cannot activate module '${moduleId}' from state '${entry.state}'.`);
    await entry.controller?.activate?.(); entry.state = 'active';
  }

  async deactivate(moduleId: string): Promise<void> {
    const entry = this.require(moduleId);
    if (entry.state === 'mounted') return;
    if (entry.state !== 'active') throw new Error(`Cannot deactivate module '${moduleId}' from state '${entry.state}'.`);
    entry.state = 'deactivating';
    try { await entry.controller?.deactivate?.(); entry.state = 'mounted'; }
    catch (error) { entry.state = 'active'; throw error; }
  }

  async unmount(moduleId: string): Promise<void> {
    const entry = this.mounted.get(moduleId);
    if (!entry) return;
    if (entry.state === 'active') await this.deactivate(moduleId);
    entry.state = 'unmounting';
    try { await entry.controller?.unmount?.(); }
    finally {
      entry.abort.abort(); entry.context.events.clear(); entry.state = 'unmounted'; this.mounted.delete(moduleId);
    }
  }

  async dispose(moduleId: string): Promise<void> {
    const entry = this.mounted.get(moduleId);
    if (!entry) return;
    try {
      if (entry.state === 'active') await this.deactivate(moduleId);
      if (entry.state !== 'unmounted') await entry.controller?.unmount?.();
      await entry.controller?.dispose?.();
    } finally {
      entry.abort.abort(); entry.context.events.clear(); entry.state = 'disposed'; this.mounted.delete(moduleId);
    }
  }

  private instance(moduleId: string): MountedModule {
    const entry = this.require(moduleId);
    return {
      moduleId, context: entry.context,
      get state() { return entry.state; },
      activate: () => this.activate(moduleId),
      deactivate: () => this.deactivate(moduleId),
      unmount: () => this.unmount(moduleId),
      dispose: () => this.dispose(moduleId),
    };
  }

  private require(moduleId: string) {
    const entry = this.mounted.get(moduleId);
    if (!entry) throw new Error(`Module '${moduleId}' is not mounted.`);
    return entry;
  }
}

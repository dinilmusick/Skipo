import { ModuleBackendAdapter } from '../backend/ModuleBackendAdapter.js';
import type { ModuleBackendAuthorization } from '../backend/ModuleBackendAdapterTypes.js';
import { NamespacedModuleEventBus } from './ModuleEventBus.js';
import type {
  ModuleController,
  ModuleHostOptions,
  ModuleRuntimeContext,
  MountedModule,
  SkipoModuleRuntimeDefinition,
  ModuleLifecycleState,
} from './ModuleRuntimeTypes.js';

const empty = Object.freeze({}) as Readonly<Record<string, unknown>>;
const resources = (value: Readonly<Record<string, unknown>> | undefined) =>
  value ? Object.freeze({ ...value }) : empty;

export class ModuleHost {
  private readonly definitions = new Map<string, SkipoModuleRuntimeDefinition>();
  private readonly mounted = new Map<string, {
    context: ModuleRuntimeContext;
    controller?: ModuleController;
    state: ModuleLifecycleState;
    abort: AbortController;
  }>();

  constructor(private readonly options: ModuleHostOptions) {
    if (!options.backend) throw new Error('ModuleHost requires parent BackendFacade.');
  }

  discover(definition: SkipoModuleRuntimeDefinition) {
    const { manifest } = definition;
    if (!manifest.application.moduleCapable || !manifest.application.standalone) {
      throw new Error('Module must be module-capable and standalone-capable.');
    }
    const id = manifest.module.id;
    if (this.definitions.has(id)) throw new Error('Duplicate module id.');

    const declared = new Set(manifest.capabilities.map((capability) => capability.id));
    for (const binding of definition.backend?.bindings ?? []) {
      const parentCapabilityId = String(binding.representation?.parentCapabilityId ?? binding.capabilityId);
      if (!declared.has(binding.capabilityId) && !declared.has(parentCapabilityId)) {
        throw new Error(`Backend binding '${binding.capabilityId}' is not declared by module '${id}'.`);
      }
    }

    this.definitions.set(id, definition);
    return manifest;
  }

  listDiscovered() {
    return Object.freeze([...this.definitions.keys()]);
  }

  listMounted() {
    return Object.freeze([...this.mounted.keys()]);
  }

  async mount(id: string): Promise<MountedModule> {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error('Module has not been discovered.');
    if (this.mounted.has(id)) throw new Error('Module is already mounted.');

    const requested = definition.manifest.capabilities.map((capability) => capability.id);
    const approved = Object.freeze(
      await this.options.authorizeCapabilities?.(definition.manifest, requested) ?? [],
    );
    const bindings = definition.backend?.bindings ?? [];
    const byCapability = new Map(bindings.map((binding) => [binding.capabilityId, binding]));
    const authorization: ModuleBackendAuthorization = {
      canDiscover: ({ capability }) => [...byCapability.values()].some((binding) =>
        String(binding.representation?.parentCapabilityId ?? binding.capabilityId) === capability.id &&
        (approved.includes(binding.capabilityId) || approved.includes(String(binding.representation?.parentCapabilityId ?? binding.capabilityId)))),
      canInvoke: ({ capability }) => [...byCapability.values()].some((binding) =>
        String(binding.representation?.parentCapabilityId ?? binding.capabilityId) === capability.id &&
        (approved.includes(binding.capabilityId) || approved.includes(String(binding.representation?.parentCapabilityId ?? binding.capabilityId)))),
    };
    const abort = new AbortController();
    const events = new NamespacedModuleEventBus(id);
    const context = Object.freeze({
      moduleId: id,
      manifest: definition.manifest,
      backend: new ModuleBackendAdapter({
        backend: this.options.backend,
        manifest: {
          moduleId: id,
          capabilities: bindings.map((binding) => ({
            capabilityId: String(binding.representation?.parentCapabilityId ?? binding.capabilityId),
            representation: binding.representation,
            inputMapping: binding.inputMapping,
            outputMapping: binding.outputMapping,
          })),
        },
        authorization,
      }),
      workspace: resources(this.options.resources?.workspace),
      auth: resources(this.options.resources?.auth),
      theme: resources(this.options.resources?.theme),
      runtime: resources(this.options.resources?.runtime),
      capabilities: new Set(approved),
      signal: abort.signal,
      events,
    });
    const entry = {
      context,
      controller: undefined as ModuleController | undefined,
      state: 'mounted' as ModuleLifecycleState,
      abort,
    };
    entry.controller = await definition.mount(context) ?? undefined;
    this.mounted.set(id, entry);
    return this.instance(id);
  }

  async activate(id: string) {
    const entry = this.requireMounted(id);
    if (entry.state !== 'mounted') throw new Error('Module is not in mounted state.');
    await entry.controller?.activate?.();
    entry.state = 'active';
  }

  async deactivate(id: string) {
    const entry = this.requireMounted(id);
    if (entry.state !== 'active') return;
    await entry.controller?.deactivate?.();
    entry.state = 'mounted';
  }

  async unmount(id: string) {
    const entry = this.mounted.get(id);
    if (!entry) return;
    if (entry.state === 'active') await this.deactivate(id);
    await entry.controller?.unmount?.();
    entry.abort.abort();
    entry.context.events.clear();
    this.mounted.delete(id);
  }

  async dispose(id: string) {
    const entry = this.mounted.get(id);
    if (!entry) return;
    if (entry.state === 'active') await this.deactivate(id);
    await entry.controller?.unmount?.();
    await entry.controller?.dispose?.();
    entry.abort.abort();
    entry.context.events.clear();
    this.mounted.delete(id);
  }

  private requireMounted(id: string) {
    const entry = this.mounted.get(id);
    if (!entry) throw new Error('Module is not mounted.');
    return entry;
  }

  private instance(id: string): MountedModule {
    const entry = this.requireMounted(id);
    return {
      moduleId: id,
      context: entry.context,
      get state() { return entry.state; },
      activate: () => this.activate(id),
      deactivate: () => this.deactivate(id),
      unmount: () => this.unmount(id),
      dispose: () => this.dispose(id),
    };
  }
}

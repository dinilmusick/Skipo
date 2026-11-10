import type {
  BackendCapabilityDescriptor,
  DiscoveredModuleCapability,
  ModuleBackendAdapterOptions,
  ModuleCapabilityDeclaration,
} from './ModuleBackendAdapterTypes.js';
import { ModuleBackendAdapterError } from './ModuleBackendAdapterTypes.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function readPath(source: unknown, path: string): unknown {
  if (path === '$') return source;
  if (!path.startsWith('$.')) throw new ModuleBackendAdapterError(`Invalid mapping path: ${path}`, 'INVALID_MAPPING');
  return path.slice(2).split('.').reduce<unknown>((value, key) => {
    if (!key || FORBIDDEN_KEYS.has(key) || !value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function applyMapping(source: unknown, mapping?: Readonly<Record<string, string>>): unknown {
  if (!mapping) return source;
  const result: Record<string, unknown> = {};
  for (const [target, path] of Object.entries(mapping)) {
    if (!target || FORBIDDEN_KEYS.has(target)) {
      throw new ModuleBackendAdapterError(`Unsafe mapping target: ${target}`, 'INVALID_MAPPING');
    }
    result[target] = readPath(source, path);
  }
  return result;
}

/**
 * Capability-limited view of a parent Skipo BackendFacade.
 * It exposes metadata, never service implementations or library objects.
 */
export class ModuleBackendAdapter {
  readonly #declarations: ReadonlyMap<string, ModuleCapabilityDeclaration>;
  readonly #options: ModuleBackendAdapterOptions;

  constructor(options: ModuleBackendAdapterOptions) {
    this.#options = options;
    if (!options?.backend || !options.manifest?.moduleId ||
        !Array.isArray(options.manifest.capabilities) || !options.authorization ||
        typeof options.authorization.canDiscover !== 'function' ||
        typeof options.authorization.canInvoke !== 'function') {
      throw new ModuleBackendAdapterError(
        'A backend, module ID, explicit capability allowlist, and authorization policy are required.',
        'INVALID_CONFIGURATION'
      );
    }
    this.#declarations = new Map();
    for (const declaration of options.manifest.capabilities) {
      if (!declaration?.capabilityId || this.#declarations.has(declaration.capabilityId)) {
        throw new ModuleBackendAdapterError('Capability declarations require unique non-empty IDs.', 'INVALID_MANIFEST');
      }
      this.#declarations.set(declaration.capabilityId, Object.freeze({ ...declaration }));
    }
  }

  async discover(): Promise<readonly DiscoveredModuleCapability[]> {
    const result: DiscoveredModuleCapability[] = [];
    for (const capability of this.#options.backend.listCapabilities()) {
      const declaration = this.#declarations.get(capability.id);
      if (!declaration) continue;
      if (await this.#options.authorization.canDiscover(this.context(capability))) {
        result.push(Object.freeze({
          ...capability,
          representation: declaration.representation
            ? Object.freeze({ ...declaration.representation }) : undefined,
        }));
      }
    }
    return Object.freeze(result);
  }

  async invoke<TInput = unknown, TOutput = unknown>(
    capabilityId: string,
    input: TInput
  ): Promise<TOutput> {
    const declaration = this.#declarations.get(capabilityId);
    if (!declaration) {
      throw new ModuleBackendAdapterError(`Module '${this.#options.manifest.moduleId}' has not declared '${capabilityId}'.`, 'CAPABILITY_NOT_DECLARED');
    }
    const capability = this.findCapability(capabilityId);
    if (!await this.#options.authorization.canInvoke(this.context(capability))) {
      throw new ModuleBackendAdapterError(`Module is not authorized to invoke '${capabilityId}'.`, 'FORBIDDEN');
    }
    const mappedInput = applyMapping(input, declaration.inputMapping);
    const output = await this.#options.backend.executeCapability(
      capability.name,
      capability.invocation.operation,
      mappedInput,
      { serviceId: capability.serviceId }
    );
    return applyMapping(output, declaration.outputMapping) as TOutput;
  }

  private findCapability(id: string): BackendCapabilityDescriptor {
    const capability = this.#options.backend.listCapabilities().find((item) => item.id === id);
    if (!capability) throw new ModuleBackendAdapterError(`Parent capability '${id}' is unavailable.`, 'CAPABILITY_NOT_FOUND');
    return capability;
  }

  private context(capability: BackendCapabilityDescriptor) {
    return { moduleId: this.#options.manifest.moduleId, capability };
  }
}

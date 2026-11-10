import type { ModuleContext } from './ModuleContext.js';
import type { ModuleController } from './ModuleLifecycle.js';
import type { ModuleManifest } from './ModuleManifest.js';

export interface ModuleDefinition {
  readonly manifest: ModuleManifest;
  mount(context: ModuleContext): ModuleController | void |
    Promise<ModuleController | void>;
}

export function validateModuleDefinition(
  value: unknown
): asserts value is ModuleDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error('Module definition must be an object.');
  }
  const definition = value as Partial<ModuleDefinition>;
  if (typeof definition.mount !== 'function') {
    throw new Error('Module definition must provide a mount(context) function.');
  }
}

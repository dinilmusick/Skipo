import { validateModuleDefinition } from '../contracts/ModuleDefinition.js';
import { validateModuleManifest } from '../contracts/ModuleManifest.js';
import type { ModuleDefinition } from '../contracts/ModuleDefinition.js';

export function validateModule(value: unknown): ModuleDefinition {
  validateModuleDefinition(value);
  validateModuleManifest(value.manifest);
  return value;
}

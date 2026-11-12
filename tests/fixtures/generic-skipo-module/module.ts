import manifest from './skipo.module.json' with { type: 'json' };
import { backendBinding } from './backend.js';
import type { SkipoModuleRuntimeDefinition } from '../../../src/module-runtime/ModuleRuntimeTypes.js';
import type { SkipoModuleManifest } from '../../../src/module-contract/ModuleTypes.js';

export const module: SkipoModuleRuntimeDefinition = {
  manifest: manifest as unknown as SkipoModuleManifest,
  backend: { bindings: [backendBinding] },
  mount(context) {
    context.events.emit('initialized', { moduleId: context.moduleId });
    return {
      activate() { context.events.emit('activated', { moduleId: context.moduleId }); },
      deactivate() { context.events.emit('deactivated', { moduleId: context.moduleId }); },
      unmount() { context.events.emit('unmounted', { moduleId: context.moduleId }); },
    };
  },
};

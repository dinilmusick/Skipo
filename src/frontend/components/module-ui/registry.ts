import type { SkipoModuleUIContribution } from './contract.js';
import { getNamespacedModuleUIId } from './contract.js';

type Listener = () => void;

export class ModuleUIRegistry {
  private readonly modules = new Map<string, SkipoModuleUIContribution>();
  private readonly listeners = new Set<Listener>();
  private currentSnapshot: readonly SkipoModuleUIContribution[] = Object.freeze([]);

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly SkipoModuleUIContribution[] => this.currentSnapshot;

  register(contribution: SkipoModuleUIContribution): () => void {
    this.validate(contribution);
    if (this.modules.has(contribution.moduleId)) {
      throw new Error(`Module UI contribution already registered: ${contribution.moduleId}`);
    }
    this.modules.set(contribution.moduleId, contribution);
    this.publish();
    return () => {
      if (this.modules.get(contribution.moduleId) !== contribution) return;
      this.modules.delete(contribution.moduleId);
      this.publish();
    };
  }

  private validate(contribution: SkipoModuleUIContribution): void {
    if (!contribution.moduleId?.trim()) throw new Error('Module UI contribution requires a stable moduleId.');
    if (!Array.isArray(contribution.exports)) throw new Error('Module UI exports must be an array.');
    const ids = new Set<string>();
    for (const item of contribution.exports) {
      if (!item.id?.trim()) throw new Error(`Module ${contribution.moduleId} has an export without a stable id.`);
      if (ids.has(item.id)) throw new Error(`Duplicate module UI export id: ${getNamespacedModuleUIId(contribution.moduleId, item.id)}`);
      ids.add(item.id);
      if (!item.label?.trim()) throw new Error(`Module UI export ${item.id} requires a label.`);
      if (typeof item.component !== 'function') throw new Error(`Module UI export ${item.id} requires a component.`);
      if (!['floating-panel', 'overlay', 'drawer', 'full-screen'].includes(item.surfaceType)) {
        throw new Error(`Module UI export ${item.id} has an unsupported surface type.`);
      }
      if (item.icon == null) throw new Error(`Module UI export ${item.id} requires an icon or button asset.`);
      if (typeof item.icon === 'object') {
        const asset = item.icon as { kind?: string; src?: string };
        if (asset.kind && (asset.kind !== 'asset' || !asset.src?.trim())) {
          throw new Error(`Module UI export ${item.id} has an invalid icon asset.`);
        }
      }
    }
  }

  private publish(): void {
    this.currentSnapshot = Object.freeze([...this.modules.values()]);
    this.listeners.forEach((listener) => listener());
  }
}

/** Host-owned registry populated by module discovery/activation. */
export const skipoModuleUIRegistry = new ModuleUIRegistry();

export function registerSkipoModuleUI(contribution: SkipoModuleUIContribution): () => void {
  return skipoModuleUIRegistry.register(contribution);
}

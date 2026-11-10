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
    const registered = Object.freeze({
      moduleId: contribution.moduleId,
      exports: Object.freeze(contribution.exports.map((item) => Object.freeze({
        ...item,
        metadata: item.metadata ? Object.freeze({ ...item.metadata }) : undefined,
      }))),
    });
    this.modules.set(registered.moduleId, registered);
    this.publish();
    return () => {
      if (this.modules.get(registered.moduleId) !== registered) return;
      this.modules.delete(registered.moduleId);
      this.publish();
    };
  }

  private validate(contribution: SkipoModuleUIContribution): void {
    if (!contribution.moduleId?.trim() || contribution.moduleId !== contribution.moduleId.trim()) {
      throw new Error('Module UI contribution requires a stable, whitespace-free moduleId.');
    }
    if (!Array.isArray(contribution.exports)) throw new Error('Module UI exports must be an array.');
    const ids = new Set<string>();
    for (const item of contribution.exports) {
      if (!item.id?.trim() || item.id !== item.id.trim()) {
        throw new Error(`Module ${contribution.moduleId} has an export without a stable, whitespace-free id.`);
      }
      if (ids.has(item.id)) throw new Error(`Duplicate module UI export id: ${getNamespacedModuleUIId(contribution.moduleId, item.id)}`);
      ids.add(item.id);
      if (!item.label?.trim()) throw new Error(`Module UI export ${item.id} requires a label.`);
      const component = item.component as unknown;
      const isComponent = typeof component === 'function' ||
        (typeof component === 'object' && component !== null && '$$typeof' in component);
      if (!isComponent) throw new Error(`Module UI export ${item.id} requires a React component.`);
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

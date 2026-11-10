import { registerSkipoModuleUI } from '../../../src/frontend/components/module-ui/registry.js';
import type { ModuleSurfaceProps } from '../../../src/frontend/components/module-ui/contract.js';

export function GenericInventorySurface({ open, onRequestClose }: ModuleSurfaceProps) {
  return open ? <button type="button" onClick={onRequestClose}>Close inventory</button> : null;
}

export function registerGenericInventoryUI() {
  return registerSkipoModuleUI({
    moduleId: 'generic.inventory',
    exports: [{
      id: 'inventory.home',
      label: 'Inventory',
      icon: 'Inventory',
      component: GenericInventorySurface,
      surfaceType: 'floating-panel',
    }],
  });
}

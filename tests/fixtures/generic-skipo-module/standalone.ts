import { module } from './module.js';
import { createMockModuleHost } from '../../../src/module-runtime/MockModuleHost.js';

export async function runStandalone() {
  const { backend, host } = createMockModuleHost({ resources: { workspace: { id: 'standalone' } } });
  backend.registerMockCapability('inventory-service/functionalities/list', async () => [{ id: 'standalone-item' }]);
  host.discover(module);
  return host.mount('generic.inventory');
}

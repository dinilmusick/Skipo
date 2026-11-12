import type { IBackendFacade } from '../backend/BackendFacadeTypes.js';
import { ModuleHost } from './ModuleHost.js';
import type { ModuleHostOptions } from './ModuleRuntimeTypes.js';

export interface MockBackend extends IBackendFacade {
  registerMockCapability(id: string, handler: (input: unknown) => unknown | Promise<unknown>): void;
}

export function createMockBackendFacade(): MockBackend {
  const handlers = new Map<string, (input: unknown) => unknown | Promise<unknown>>();
  const backend = {
    namespaces: {}, libraries: {}, functionalities: {}, orchestrations: {},
    registerService() { return backend; },
    getLibrary() { throw new Error('Mock backend library access is not exposed.'); },
    getFunctionality() { throw new Error('Mock backend functionality access is not exposed.'); },
    getOrchestration() { throw new Error('Mock backend orchestration access is not exposed.'); },
    async executeCapability(name: string, _operation?: string, input?: unknown, options?: { serviceId?: string }) {
      const fullId = options?.serviceId ? `${options.serviceId}/functionalities/${name}` : name;
      const handler = handlers.get(fullId) ?? handlers.get(name);
      if (!handler) throw new Error(`Mock capability not found: ${fullId}`);
      return await handler(input);
    },
    getService() { throw new Error('Mock backend service access is not exposed.'); },
    hasCapability(name: string) { return handlers.has(name); },
    listServices() { return []; },
    listCapabilities() {
      return Object.freeze([...handlers.keys()].map(id => ({
        id, name: id.split('/').pop() ?? id, serviceId: id.split('/')[0] ?? id,
        serviceName: id.split('/')[0] ?? id, serviceVersion: 'test',
        category: 'functionalities' as const, description: id,
        invocation: { kind: 'functionality' as const, operation: id.split('/').pop() ?? id },
        capabilities: [], protocols: ['http', 'mcp'],
      })));
    },
    registerMockCapability(id: string, handler: (input: unknown) => unknown | Promise<unknown>) { handlers.set(id, handler); },
  } as MockBackend;
  return backend;
}

export function createMockModuleHost<TBackend extends IBackendFacade | undefined = undefined>(
  options: Omit<Partial<ModuleHostOptions>, 'backend'> & { backend?: TBackend } = {},
): {
  backend: TBackend extends IBackendFacade ? TBackend : MockBackend;
  host: ModuleHost;
} {
  const backend = options.backend ?? createMockBackendFacade();
  const host = new ModuleHost({
    backend,
    resources: options.resources,
    authorizeCapabilities: options.authorizeCapabilities,
  });
  return {
    backend: backend as TBackend extends IBackendFacade ? TBackend : MockBackend,
    host,
  };
}

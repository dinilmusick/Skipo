import type { IBackendFacade } from '../../backend/BackendFacadeTypes.js';
import type { ModuleParentContext } from '../contracts/ModuleContext.js';
import { ModuleHost, type ModuleHostOptions } from '../host/ModuleHost.js';

export interface MockBackendFacade {
  readonly facade: IBackendFacade;
  registerLibrary(name: string, value: unknown): void;
  registerFunctionality(name: string, value: unknown): void;
  registerOrchestration(name: string, value: unknown): void;
  registerExecutor(
    capabilityName: string,
    executor: (operation: string, input: unknown) => unknown | Promise<unknown>
  ): void;
}

export function createMockBackendFacade(): MockBackendFacade {
  const libraries = new Map<string, unknown>();
  const functionalities = new Map<string, unknown>();
  const orchestrations = new Map<string, unknown>();
  const executors = new Map<string,
    (operation: string, input: unknown) => unknown | Promise<unknown>>();
  const missing = (name: string, category: string): never => {
    throw new Error(`Mock backend ${category} '${name}' is not registered.`);
  };
  const facade = {
    namespaces: {},
    libraries: Object.create(null) as Record<string, unknown>,
    functionalities: Object.create(null) as Record<string, unknown>,
    orchestrations: Object.create(null) as Record<string, unknown>,
    registerService() {
      throw new Error('Mock backend does not expose parent service registration.');
    },
    getLibrary<T = unknown>(name: string): T {
      if (!libraries.has(name)) return missing(name, 'library');
      return libraries.get(name) as T;
    },
    getFunctionality<T = unknown>(name: string): T {
      if (!functionalities.has(name)) return missing(name, 'functionality');
      return functionalities.get(name) as T;
    },
    getOrchestration<T = unknown>(name: string): T {
      if (!orchestrations.has(name)) return missing(name, 'orchestration');
      return orchestrations.get(name) as T;
    },
    async executeCapability<TIn = unknown, TOut = unknown>(
      capabilityName: string,
      operation = capabilityName,
      input?: TIn
    ): Promise<TOut> {
      const executor = executors.get(capabilityName);
      if (!executor) return missing(capabilityName, 'executor');
      return await executor(operation, input) as TOut;
    },
    getService(name: string) {
      return missing(name, 'service');
    },
    hasCapability(name: string, category?: string): boolean {
      if (category === 'libraries') return libraries.has(name);
      if (category === 'functionalities') return functionalities.has(name);
      if (category === 'orchestrations') return orchestrations.has(name);
      return libraries.has(name) || functionalities.has(name) ||
        orchestrations.has(name) || executors.has(name);
    },
    listServices() {
      return [];
    }
  } as unknown as IBackendFacade;

  return {
    facade,
    registerLibrary: (name, value) => { libraries.set(name, value); },
    registerFunctionality: (name, value) => { functionalities.set(name, value); },
    registerOrchestration: (name, value) => { orchestrations.set(name, value); },
    registerExecutor: (name, executor) => { executors.set(name, executor); }
  };
}

export interface MockModuleHostOptions {
  readonly hostId?: string;
  readonly backend?: IBackendFacade;
  readonly workspace?: Readonly<Record<string, unknown>>;
  readonly authentication?: Readonly<Record<string, unknown>>;
  readonly theme?: Readonly<Record<string, unknown>>;
  readonly runtime?: Readonly<Record<string, unknown>>;
  readonly authorizeCapabilities?: ModuleParentContext['authorizeCapabilities'];
}

export class MockModuleHost extends ModuleHost {
  readonly mockBackend: MockBackendFacade;

  constructor(options: MockModuleHostOptions = {}) {
    const mockBackend = createMockBackendFacade();
    const parent: ModuleParentContext = {
      backend: options.backend ?? mockBackend.facade,
      workspace: options.workspace ?? { id: 'mock-workspace' },
      authentication: options.authentication ?? {
        subject: 'mock-user',
        authenticated: true
      },
      theme: options.theme ?? { id: 'mock-theme' },
      runtime: options.runtime ?? { environment: 'test' },
      hostId: options.hostId ?? 'mock-module-host',
      authorizeCapabilities: options.authorizeCapabilities ??
        ((_module, requested) => requested)
    };
    const hostOptions: ModuleHostOptions = {
      parent,
      hostId: options.hostId
    };
    super(hostOptions);
    this.mockBackend = mockBackend;
  }
}

/** Canonical contract shared by every mounted or standalone Skipo module. */
export type ModuleCapability = string;

export interface SkipoModuleManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Declared even when empty; the host grants only these capabilities. */
  readonly capabilities: readonly ModuleCapability[];
  /** Explicit module identifiers required by this module. */
  readonly dependencies: readonly string[];
  /** Explicit external package dependencies; never inferred from imports. */
  readonly packageDependencies: readonly string[];
}

export interface ModuleBackendFacade {
  has(capability: ModuleCapability): boolean;
  invoke<TInput = unknown, TOutput = unknown>(
    capability: ModuleCapability,
    input: TInput,
  ): Promise<TOutput>;
}

export interface ModuleNavigationInterface {
  registerRoute(route: ModuleRoute): void;
}

export interface ModuleRoute {
  readonly id: string;
  readonly path: string;
  readonly render: () => unknown;
}

export interface ModuleUIExport {
  readonly routes: readonly ModuleRoute[];
  readonly panels?: readonly { readonly id: string; readonly render: () => unknown }[];
}

/** The only parent-owned resources modules may consume. */
export interface SkipoModuleHost {
  readonly backend: ModuleBackendFacade;
  readonly navigation: ModuleNavigationInterface;
}

/** Canonical UI is returned as data from createUI; modules do not mutate host chrome. */
export interface SkipoModule {
  readonly manifest: SkipoModuleManifest;
  activate(host: SkipoModuleHost): Promise<void> | void;
  createUI(host: SkipoModuleHost): ModuleUIExport;
  deactivate?(host: SkipoModuleHost): Promise<void> | void;
}

/** Minimal host adapter for isolated tests and standalone module execution. */
export function createStandaloneModuleHost(
  handlers: Readonly<Record<string, (input: unknown) => unknown | Promise<unknown>>> = {},
): SkipoModuleHost {
  const registeredRoutes: ModuleRoute[] = [];
  return {
    backend: {
      has: (capability) => Object.prototype.hasOwnProperty.call(handlers, capability),
      invoke: async <TInput = unknown, TOutput = unknown>(capability: string, input: TInput): Promise<TOutput> => {
        const handler = handlers[capability];
        if (!handler) throw new Error(`Undeclared standalone capability: ${capability}`);
        return await handler(input) as TOutput;
      },
    },
    navigation: {
      registerRoute: (route) => { registeredRoutes.push(route); },
    },
  };
}

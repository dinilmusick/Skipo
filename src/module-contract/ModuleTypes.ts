export type ModuleExecutionMode = 'standalone' | 'embedded' | 'both';
export type ModuleLifecyclePhase = 'validate' | 'initialize' | 'start' | 'stop' | 'dispose';

export interface ModuleCapability {
  readonly id: string;
  readonly description: string;
  readonly version?: string;
}
export interface ModuleRuntimeRequirement {
  readonly id: string;
  readonly range?: string;
  readonly optional?: boolean;
}
export interface ModuleResourceRequirement {
  readonly id: string;
  readonly kind: string;
  readonly required: boolean;
  readonly description?: string;
}
export interface ModuleBackendFacadeDeclaration {
  readonly mode: 'declared';
  readonly entry: string;
  readonly consumes: readonly string[];
}
export interface ModuleUiExport {
  readonly id: string;
  readonly entry: string;
  readonly kind: 'page' | 'panel' | 'widget' | 'navigation';
  readonly route?: string;
}
export interface SkipoModuleManifest {
  readonly contractVersion: string;
  readonly module: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description?: string;
  };
  readonly application: {
    readonly framework: 'skipo';
    readonly root: string;
    readonly standalone: true;
    readonly moduleCapable: true;
    readonly execution: ModuleExecutionMode;
  };
  readonly api: {
    readonly baseRoute: string;
    readonly backendFacade: ModuleBackendFacadeDeclaration;
  };
  readonly capabilities: readonly ModuleCapability[];
  readonly runtime: {
    readonly targets: readonly string[];
    readonly requirements: readonly ModuleRuntimeRequirement[];
  };
  readonly resources: {
    readonly requires: readonly ModuleResourceRequirement[];
    readonly optional: readonly ModuleResourceRequirement[];
  };
  readonly ui: {
    readonly exports: readonly ModuleUiExport[];
  };
  readonly lifecycle: {
    readonly supported: readonly ModuleLifecyclePhase[];
  };
}
export interface ModuleValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export interface ModuleValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ModuleValidationIssue[];
  readonly warnings: readonly ModuleValidationIssue[];
}
export interface DiscoveredModule {
  readonly directory: string;
  readonly manifestPath: string;
  readonly manifest: SkipoModuleManifest;
}
export interface ModuleDiscoveryResult {
  readonly modules: readonly DiscoveredModule[];
  readonly errors: readonly { directory: string; issues: readonly ModuleValidationIssue[] }[];
}

export interface JsonSchema {
  readonly type: "object" | "string" | "number" | "integer" | "boolean" | "array";
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly additionalProperties?: boolean;
}
export interface CapabilityDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
}
export interface CapabilityInvocationContext {
  readonly moduleId: string;
  readonly applicationId: string;
  readonly userId?: string;
  readonly correlationId: string;
}
export interface BackendFacade {
  discoverCapabilities(): readonly CapabilityDescriptor[];
  invokeCapability(name: string, input: unknown, context: CapabilityInvocationContext): Promise<unknown>;
}
export interface ParentApplicationContext {
  readonly applicationId: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface DiscoveredCapability extends CapabilityDescriptor { readonly approved: boolean; }
export interface ModuleBackendAccess {
  discoverCapabilities(): readonly DiscoveredCapability[];
  inspectCapability(name: string): DiscoveredCapability;
  invoke<TInput = unknown, TOutput = unknown>(name: string, input: TInput): Promise<TOutput>;
}
export interface ModuleRuntimeContext {
  readonly mode: "standalone" | "embedded";
  readonly moduleId: string;
  readonly application: ParentApplicationContext;
  readonly backend: ModuleBackendAccess;
}
export interface ModuleUiSurface {
  readonly id: string;
  readonly title: string;
  activate(context: ModuleRuntimeContext): Promise<unknown> | unknown;
}
export interface SkipoModuleManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly uiSurfaces: readonly { readonly id: string; readonly title: string }[];
}
export interface SkipoModule {
  readonly manifest: SkipoModuleManifest;
  readonly uiSurfaces: readonly ModuleUiSurface[];
  initialize(context: ModuleRuntimeContext): Promise<void> | void;
  mount(context: ModuleRuntimeContext): Promise<void> | void;
  unmount(): Promise<void> | void;
  dispose(): Promise<void> | void;
}
export type ModuleLifecycleState = "discovered" | "initialized" | "mounted" | "unmounted" | "disposed";

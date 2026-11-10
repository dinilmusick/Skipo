/**
 * Machine-readable, implementation-free capability metadata exposed by BackendFacade.
 */
import type { CapabilityCategory, CrossServiceExecutionOptions } from './BackendFacadeTypes.js';

export interface BackendCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly category: Exclude<CapabilityCategory, 'libraries'>;
  readonly description: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  readonly invocation: {
    readonly kind: 'functionality' | 'orchestration';
    readonly operation: string;
  };
  readonly capabilities: readonly string[];
  readonly protocols: readonly string[];
}

export interface ModuleCapabilityDeclaration {
  readonly capabilityId: string;
  readonly representation?: Readonly<Record<string, unknown>>;
  /** Maps module input fields to JSONPath-like paths rooted at $. */
  readonly inputMapping?: Readonly<Record<string, string>>;
  /** Maps parent output fields to JSONPath-like paths rooted at $. */
  readonly outputMapping?: Readonly<Record<string, string>>;
}

export interface ModuleBackendManifest {
  readonly moduleId: string;
  /** Explicit allowlist. Empty or omitted declarations grant no access. */
  readonly capabilities: readonly ModuleCapabilityDeclaration[];
}

export interface ModuleCapabilityAuthorizationContext {
  readonly moduleId: string;
  readonly capability: BackendCapabilityDescriptor;
}

export interface ModuleBackendAuthorization {
  canDiscover(context: ModuleCapabilityAuthorizationContext): boolean | Promise<boolean>;
  canInvoke(context: ModuleCapabilityAuthorizationContext): boolean | Promise<boolean>;
}

export interface ModuleBackendAdapterOptions {
  readonly backend: {
    listCapabilities(): readonly BackendCapabilityDescriptor[];
    executeCapability<TIn = unknown, TOut = unknown>(
      capabilityName: string,
      operation?: string,
      input?: TIn,
      options?: CrossServiceExecutionOptions
    ): Promise<TOut>;
  };
  readonly manifest: ModuleBackendManifest;
  /** Required: adapter construction fails closed without an authorization policy. */
  readonly authorization: ModuleBackendAuthorization;
}

export interface DiscoveredModuleCapability extends BackendCapabilityDescriptor {
  readonly representation?: Readonly<Record<string, unknown>>;
}

export class ModuleBackendAdapterError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ModuleBackendAdapterError';
  }
}

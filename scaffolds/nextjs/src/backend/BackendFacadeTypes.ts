/**
 * @file BackendFacadeTypes.ts
 * @description Contract types and interfaces for the Skipo BackendFacade.
 * Conforms to L7 (App Architecture Spec) and L9 (Lines <= 200).
 */

import type {
  ServiceNamespace,
  OperationContext,
} from '@ultrst-armada/krnl';

/** Shared structural contract of current Kloks facades and legacy Krnl facades. */
export interface RegisteredServiceFacade {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export type CapabilityCategory = 'libraries' | 'functionalities' | 'orchestrations';

export interface CapabilityOwnerInfo {
  readonly capabilityName: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly category: CapabilityCategory;
}

export interface CrossServiceExecutionOptions extends OperationContext {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  /** Selects an exact registered owner when capability names are duplicated. */
  serviceId?: string;
}

export interface IBackendFacade {
  readonly namespaces: Record<string, ServiceNamespace>;
  readonly libraries: Record<string, unknown>;
  readonly functionalities: Record<string, unknown>;
  readonly orchestrations: Record<string, unknown>;

  registerService(facade: RegisteredServiceFacade, alias?: string): this;
  listCapabilities(): readonly import('./BackendCapabilityCatalog.js').BackendCapabilityDescriptor[];
  getLibrary<TLib = unknown>(name: string, serviceNamespace?: string): TLib;
  getFunctionality<TFunc = unknown>(name: string, serviceNamespace?: string): TFunc;
  getOrchestration<TOrch = unknown>(name: string, serviceNamespace?: string): TOrch;
  executeCapability<TIn = unknown, TOut = unknown>(
    capabilityName: string,
    operation?: string,
    input?: TIn,
    options?: CrossServiceExecutionOptions
  ): Promise<TOut>;
  getService(nameOrId: string): RegisteredServiceFacade;
  hasCapability(name: string, category?: CapabilityCategory): boolean;
  listServices(): string[];
}

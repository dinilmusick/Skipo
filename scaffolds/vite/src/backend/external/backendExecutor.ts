import { CapabilityExecutor, ExternalCapabilityContext } from "./contract.js";
export interface CanonicalBackendInvoker {
  executeCapability<TInput = unknown, TOutput = unknown>(capabilityName: string, operation?: string, input?: TInput, options?: { metadata?: Record<string, unknown>; correlationId?: string }): Promise<TOutput>;
}
/** Adapts both protocols to the existing Skipo BackendFacade execution boundary. */
export function createBackendCapabilityExecutor(backend: CanonicalBackendInvoker): CapabilityExecutor {
  return {
    execute(serviceId: string, operationId: string, input: unknown, context: ExternalCapabilityContext) {
      return backend.executeCapability(serviceId, operationId, input, {
        correlationId: context.requestId,
        metadata: {
          externalInterface: true,
          transport: context.transport,
          principal: context.principal ? { userId: context.principal.userId, roles: context.principal.roles ?? [], sessionId: context.principal.sessionId } : null,
        },
      });
    },
  };
}

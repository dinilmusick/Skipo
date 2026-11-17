import type { AikoCapability } from '@ultrst-armada/kloks/aiko';
import type { FodEndpointDescriptor } from '@ultrst-armada/kloks/fod';
import { backendFacade, type BackendFacade } from './BackendFacade.js';
import { ExternalInterfaceError, type ApplicationCapability } from './external/contract.js';
import { CapabilityRegistry, validateCapabilityValue } from './external/registry.js';
import { createBackendCapabilityExecutor } from './external/backendExecutor.js';
import { createExternalHttpHandler } from './external/httpAdapter.js';
import { createMcpHandler } from './external/mcpAdapter.js';
import { getLuthSession } from './auth/luthSession.js';

export function createAppExternalInterfaces(
  backend: BackendFacade = backendFacade,
  remoteStaticFacadeIds: readonly string[] = [],
) {
  // The application chooses these IDs during server composition. Saved workflows
  // and request metadata must never populate this allowlist.
  const remoteIds = new Set(remoteStaticFacadeIds);
  const descriptors = backend.listCapabilities().map(capability => ({
    remote: capability.category === 'functionalities' && remoteIds.has(capability.id),
    hasInputSchema: capability.inputSchema !== undefined,
    registration: {
      // Escape the facade ID into a stable tool name shared across transports.
      id: capability.id.replace(/[^a-zA-Z0-9.-]/gu, character => '_' + character.codePointAt(0)!.toString(16) + '_'),
      name: capability.name,
      serviceName: capability.serviceName,
      description: capability.description || capability.name,
      inputSchema: capability.inputSchema ?? { type: 'object', additionalProperties: true },
      outputSchema: capability.outputSchema ?? { type: 'object', additionalProperties: true },
      invocation: { serviceId: capability.serviceId, operationId: capability.invocation.operation },
      access: 'authenticated',
      discoverable: true,
    } satisfies ApplicationCapability,
  }));
  const staticFacade = descriptors.filter(entry => entry.remote);
  const staticServices = new Map(staticFacade.map(({ registration }) => [
    registration.id, backend.getService(registration.invocation.serviceId),
  ]));
  const registry = new CapabilityRegistry(
    createBackendCapabilityExecutor(backend),
    staticFacade.map(entry => entry.registration),
    capability => {
      const { serviceId, operationId } = capability.invocation;
      if (backend.getService(serviceId) !== staticServices.get(capability.id)) return false;
      const matches = backend.listCapabilities().filter(item => item.serviceId === serviceId && item.invocation.operation === operationId);
      return matches.length === 1 && matches[0].category === 'functionalities';
    },
  );
  for (const entry of descriptors) {
    if (!entry.remote) registry.register(entry.registration);
  }
  const typedInputs = new Set(descriptors.filter(entry => entry.hasInputSchema).map(entry => entry.registration.id));
  const authenticate = async (request: Request) => {
    const session = await getLuthSession(request);
    if (!session?.user?.id) return null;
    return {
      userId: String(session.user.id),
      sessionId: String(session.session?.id ?? ''),
      roles: Array.isArray(session.user.roles) ? session.user.roles.map(String) : [],
    };
  };
  async function executionBindings(request: Request) {
    const principal = await authenticate(request);
    if (!principal) throw new ExternalInterfaceError('UNAUTHENTICATED', 'Authentication is required.', 401);

    const requestId = crypto.randomUUID();
    const invoke = async (id: string, input: unknown, transport: 'workflow' | 'agent') => {
      const current = await authenticate(request);
      if (!current || current.userId !== principal.userId || current.sessionId !== principal.sessionId) {
        throw new ExternalInterfaceError('UNAUTHENTICATED', 'The execution session is no longer valid.', 401);
      }
      try {
        return await registry.invoke(id, input, { principal: current, transport, requestId });
      } catch (error) {
        if (error instanceof ExternalInterfaceError && error.expose) throw error;
        throw new ExternalInterfaceError('INTERNAL_ERROR', 'Capability execution failed.', 500);
      }
    };

    const catalog = registry.list(principal);
    const endpoints: FodEndpointDescriptor[] = catalog.map(capability => ({
      id: capability.id,
      serviceId: capability.invocation.serviceId,
      serviceName: capability.serviceName ?? capability.invocation.serviceId,
      operationId: capability.invocation.operationId,
      operationName: capability.name ?? capability.id,
      description: capability.description,
      inputSchema: capability.inputSchema,
      outputSchema: capability.outputSchema,
      invoke: input => invoke(capability.id, input, 'workflow'),
    }));
    const aikoCapabilities: AikoCapability[] = catalog.map(capability => ({
      id: capability.id,
      name: capability.name ?? capability.id,
      description: capability.description,
      sourceKind: 'endpoint',
      sourceId: capability.id,
      inputSchema: capability.inputSchema,
      validateInput: typedInputs.has(capability.id)
        ? (input: unknown) => validateCapabilityValue(capability.inputSchema, input) : undefined,
      execute: input => invoke(capability.id, input, 'agent'),
    }));
    return { endpoints, aikoCapabilities };
  }

  return {
    registry,
    executionBindings,
    http: createExternalHttpHandler({ registry, authenticate }),
    mcp: createMcpHandler({ registry, authenticate }),
  };
}

export const externalInterfaces = createAppExternalInterfaces();

import type { AikoCapability } from '@ultrst-armada/kloks/aiko';
import type { FodEndpointDescriptor } from '@ultrst-armada/kloks/fod';
import { backendFacade, type BackendFacade } from './BackendFacade.js';
import { ExternalInterfaceError } from './external/contract.js';
import { CapabilityRegistry } from './external/registry.js';
import { createBackendCapabilityExecutor } from './external/backendExecutor.js';
import { createExternalHttpHandler } from './external/httpAdapter.js';
import { createMcpHandler } from './external/mcpAdapter.js';
import { getLuthSession } from './auth/luthSession.js';

export function createAppExternalInterfaces(backend: BackendFacade = backendFacade) {
  const registry = new CapabilityRegistry(createBackendCapabilityExecutor(backend));
  for (const capability of backend.listCapabilities()) {
    registry.register({
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
    });
  }
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

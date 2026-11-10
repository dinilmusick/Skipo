import { CapabilityRegistry } from "./external/registry.js";
import { createBackendCapabilityExecutor } from "./external/backendExecutor.js";
import { createExternalHttpHandler } from "./external/httpAdapter.js";
import { createMcpHandler } from "./external/mcpAdapter.js";
import { getLuthSession } from "./auth/luthSession.js";

export function createAppExternalInterfaces(backend: { services: Record<string, any> }) {
  const canonicalBackend = {
    executeCapability: async (serviceId: string, operationId: string, input: unknown, options?: any) => {
      const service = backend.services[serviceId];
      if (!service || typeof service.execute !== "function") throw new Error("External capability service is not registered.");
      return service.execute(operationId, input, { ...options, auth: options?.metadata?.principal ?? null });
    },
  };
  const registry = new CapabilityRegistry(createBackendCapabilityExecutor(canonicalBackend));
  const authenticate = async (request: Request) => {
    const session = await getLuthSession(request);
    if (!session?.user?.id) return null;
    return { userId: String(session.user.id), sessionId: String(session.session?.id ?? ""), roles: Array.isArray(session.user.roles) ? session.user.roles.map(String) : Array.isArray(session.roles) ? session.roles.map(String) : [] };
  };
  return {
    registry,
    http: createExternalHttpHandler({ registry, authenticate }),
    mcp: createMcpHandler({ registry, authenticate }),
  };
}

import { backendFacade, type BackendFacade } from './BackendFacade.js';
import { CapabilityRegistry } from './external/registry.js';
import { createBackendCapabilityExecutor } from './external/backendExecutor.js';
import { createExternalHttpHandler } from './external/httpAdapter.js';
import { createMcpHandler } from './external/mcpAdapter.js';
import { getLuthSession } from './auth/luthSession.js';
import { GuestLeaseService } from './auth/guestLease.js';
import { withGuestRequestGuards, type GuestRequestGuardOptions } from './external/guestRequestGuard.js';
import type { GuestExternalPrincipal } from './external/contract.js';

export interface AppExternalInterfaceOptions {
  guestLeaseService?: GuestLeaseService;
  guestCapabilities?: readonly string[];
  guestRequestGuard?: GuestRequestGuardOptions;
}
function guestCredential(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== '__Host-skipo_guest') continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}
function isGuestExternalRoute(request: Request): boolean {
  const path = new URL(request.url).pathname;
  return path === '/mcp' || path === '/api/mcp' || path === '/api/capabilities' ||
    path === '/api/openapi.json' || path.startsWith('/api/capabilities/');
}

export function createAppExternalInterfaces(
  backend: BackendFacade = backendFacade,
  options: AppExternalInterfaceOptions = {},
) {
  const registry = new CapabilityRegistry(createBackendCapabilityExecutor(backend));
  const guestCapabilities = new Set(options.guestCapabilities ?? []);
  for (const capability of backend.listCapabilities()) {
    registry.register({
      id: capability.id,
      description: capability.description || capability.name,
      inputSchema: capability.inputSchema ?? { type: 'object', additionalProperties: true },
      outputSchema: capability.outputSchema ?? { type: 'object', additionalProperties: true },
      invocation: { serviceId: capability.serviceId, operationId: capability.invocation.operation },
      access: 'authenticated',
      guestAccess: guestCapabilities.has(capability.id),
      discoverable: true,
    });
  }
  const resolveGuest = async (request: Request): Promise<GuestExternalPrincipal | null> => {
    if (!isGuestExternalRoute(request) || !options.guestLeaseService) return null;
    const credential = guestCredential(request);
    if (!credential) return null;
    return options.guestLeaseService.validate(credential);
  };
  const authenticate = async (request: Request) => {
    const session = await getLuthSession(request);
    if (session?.user?.id) {
      return {
        kind: 'authenticated' as const,
        userId: String(session.user.id),
        sessionId: String(session.session?.id ?? ''),
        roles: Array.isArray(session.user.roles) ? session.user.roles.map(String) : [],
      };
    }
    return resolveGuest(request);
  };
  const http = createExternalHttpHandler({ registry, authenticate });
  const mcp = createMcpHandler({ registry, authenticate });
  const guarded = async (request: Request): Promise<Response | null> => {
    const credential = guestCredential(request);
    if (!credential || !isGuestExternalRoute(request)) return (await http(request)) ?? (await mcp(request));
    const principal = await resolveGuest(request);
    if (!principal) return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Guest lease is invalid or expired.' } }, { status: 401, headers: { 'cache-control': 'no-store' } });
    return withGuestRequestGuards(request, principal, options.guestRequestGuard, async (guardedRequest) =>
      (await http(guardedRequest)) ?? (await mcp(guardedRequest)));
  };
  return {
    registry,
    http: async (request: Request) => {
      if (!isGuestExternalRoute(request) || !guestCredential(request)) return http(request);
      return guarded(request);
    },
    mcp: async (request: Request) => {
      if (!isGuestExternalRoute(request) || !guestCredential(request)) return mcp(request);
      return guarded(request);
    },
  };
}

export const externalInterfaces = createAppExternalInterfaces();

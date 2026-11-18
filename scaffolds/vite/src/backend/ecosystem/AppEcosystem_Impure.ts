import { getLuthSession } from '../auth/luthSession.js';
import { createEcosystemRuntime } from './generated/ecosystemRuntime_Impure.js';
import { workspaceCapabilities, workspaceServiceCapabilities } from './generated/workspaceCapabilities_Impure.js';
import { appId, appIdentityAuthorityVerified } from './appIdentity_Pure.js';

const invocationPath = '/api/ecosystem/invoke';
const enrollmentRequiredRuntime = {
  observe: async (_env: Record<string, unknown>) => undefined,
  heartbeat: async (_env: Record<string, unknown>, _scheduled = false) => undefined,
  start: async (_env: Record<string, unknown>) => undefined,
  handle: async (request: Request, _env?: Record<string, unknown>): Promise<Response | null> => {
    if (new URL(request.url).pathname !== invocationPath) return null;
    return Response.json({ error: 'APP_ENROLLMENT_REQUIRED' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  },
};

// The project manifest is only a local reference. Until a trusted runtime
// registry integration proves the app/deployment pairing, this module cannot
// publish heartbeats or service cross-app invocations.
export const ecosystem = appId && appIdentityAuthorityVerified
  ? createEcosystemRuntime({
      appId,
      authenticate: async request => (await getLuthSession(request))?.user?.id ?? null,
      capabilities: workspaceCapabilities(appId),
      serviceCapabilities: workspaceServiceCapabilities,
    })
  : enrollmentRequiredRuntime;

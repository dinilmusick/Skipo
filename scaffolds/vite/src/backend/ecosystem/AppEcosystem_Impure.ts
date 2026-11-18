import { getLuthSession } from '../auth/luthSession.js';
import { createEcosystemRuntime } from './generated/ecosystemRuntime_Impure.js';
import { workspaceCapabilities, workspaceServiceCapabilities } from './generated/workspaceCapabilities_Impure.js';
import { appId, appIdentityAuthorityVerified } from './appIdentity_Pure.js';

const invocationPath = '/api/ecosystem/invoke';
const enrollmentRequiredRuntime = {
  observe: async (_env: Record<string, unknown>) => undefined,
  handle: async (request: Request, _env?: Record<string, unknown>): Promise<Response | null> => {
    if (new URL(request.url).pathname !== invocationPath) return null;
    return Response.json({ error: 'APP_ENROLLMENT_REQUIRED' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  },
};

// A manifest app_id is only a local reference. The remote-call runtime and its
// deployment heartbeat stay disabled until a separate live registry proof
// supplies appIdentityAuthorityVerified=true. Editable manifest metadata never
// flips this generated constant.
export const ecosystem = appId && appIdentityAuthorityVerified
  ? createEcosystemRuntime({
      appId,
      authenticate: async request => (await getLuthSession(request))?.user?.id ?? null,
      capabilities: workspaceCapabilities(appId),
      serviceCapabilities: workspaceServiceCapabilities,
    })
  : enrollmentRequiredRuntime;

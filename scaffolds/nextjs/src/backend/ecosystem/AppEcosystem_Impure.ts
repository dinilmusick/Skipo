import { getLuthSession } from '../auth/luthSession.js';
import { createEcosystemRuntime } from './generated/ecosystemRuntime_Impure.js';
import { workspaceCapabilities, workspaceServiceCapabilities } from './generated/workspaceCapabilities_Impure.js';

const appId = 'my-app';

export const ecosystem = createEcosystemRuntime({
  appId,
  authenticate: async request => (await getLuthSession(request))?.user?.id ?? null,
  capabilities: workspaceCapabilities(appId),
  serviceCapabilities: workspaceServiceCapabilities,
});

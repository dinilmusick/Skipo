import { getLuthSession } from '../auth/luthSession.js';
import { createEcosystemRuntime } from './generated/ecosystemRuntime_Impure.js';
import { workspaceCapabilities, workspaceServiceCapabilities } from './generated/workspaceCapabilities_Impure.js';
import { appId, appRegistrationStatus } from './appIdentity_Pure.js';

export const ecosystem = createEcosystemRuntime({
  appId,
  registrationStatus: appRegistrationStatus,
  authenticate: async request => (await getLuthSession(request))?.user?.id ?? null,
  capabilities: workspaceCapabilities(appId),
  serviceCapabilities: workspaceServiceCapabilities,
});

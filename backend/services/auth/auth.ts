/**
 * @file auth.ts
 * @description Authentication Service Facade.
 * Conforms to APP_ARCHITECTURE_SPEC Sections 5 & 6.
 */

import type { Runtime, Deployment } from '@skipo/backend';
import { authEngine } from './server/authEngine';
import { remoteAuthClient } from './remote/remoteAuthClient';

export const runtime: Runtime = 'server';
export const deployment: Deployment = 'local';

export const service = {
  name: 'auth',
  runtime,
  deployment,
  authenticateUser: async (credentials: { username?: string; email?: string; password: string }) => {
    if (deployment === 'local') {
      return authEngine.login(credentials);
    }
    return remoteAuthClient.authenticate(credentials);
  },
  verifySession: async (token: string) => {
    if (deployment === 'local') {
      return authEngine.verify(token);
    }
    return remoteAuthClient.verify(token);
  },
  revokeSession: async (sessionId: string) => {
    if (deployment === 'local') {
      return authEngine.revoke(sessionId);
    }
    return remoteAuthClient.revoke(sessionId);
  },
};

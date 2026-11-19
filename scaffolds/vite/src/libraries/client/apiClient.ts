// ══════════════════════════════════════════════════════════════════════════════
// SKIPO CANONICAL API CLIENT (Aspect 13 & BottomStrip Indicator Integration)
// Encapsulates all network communication to preserve component purity
// ══════════════════════════════════════════════════════════════════════════════

import { luthAuthClient, luthFetch } from './luthAuthClient';

async function wrappedFetch(url: string, init?: RequestInit): Promise<Response> {
  return luthFetch(url, init);
}

export const apiClient = {
  /** Compatibility entrypoint: credentials must only be collected by Luth.
   * This starts the first-party BFF flow and deliberately does NOT claim
   * successful authentication until the callback and session are verified. */
  async login(_email?: string, _password?: string, isAdmin: boolean = false) {
    if (isAdmin) throw new Error('Administrative authentication is not provided by Luth user login.');
    luthAuthClient.signInWithEmail();
    return { authenticated: false, redirecting: true };
  },

  /** All registration is hosted by Luth; applications never accept passwords. */
  async register(_data: { name: string; email: string; password: string; role?: string }) {
    luthAuthClient.startSignIn();
    return { authenticated: false, redirecting: true };
  },

  async getWorkspaces(_userId?: string) {
    const res = await wrappedFetch('/api/auth/workspaces');
    return res.json();
  },

  async createWorkspace(_userId: string, data: Record<string, unknown>) {
    const res = await wrappedFetch('/api/auth/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getStorageConnections(_userId?: string) {
    const res = await wrappedFetch('/api/auth/storage/connections');
    return res.json();
  },

  async saveStorageConnection(_userId: string, data: Record<string, unknown>) {
    const res = await wrappedFetch('/api/auth/storage/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async testStorageConnection(data: Record<string, unknown>) {
    const res = await wrappedFetch('/api/auth/storage/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // BullMQ Command Queue Dispatches
  async dispatchCommand(type: string, payload: Record<string, unknown> = {}, priority: string = 'NORMAL') {
    const res = await wrappedFetch('/api/commands/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, priority }),
    });
    return res.json();
  },

  async getCommandStatus(jobId: string) {
    const res = await wrappedFetch(`/api/commands/${jobId}/status`);
    return res.json();
  },
};

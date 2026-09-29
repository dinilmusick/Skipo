/**
 * @file apiClient.ts
 * @description Standard client-side HTTP API boundary for Skipo applications.
 * Encapsulates network communication to preserve component purity (Aspect 13).
 * Conforms to Skipo Governance (< 200 lines).
 */

export const apiClient = {
  async login(email?: string, password?: string, isAdmin: boolean = false) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, isAdmin }),
    });
    return res.json();
  },

  async register(data: { name: string; email: string; password: string; role?: string }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getWorkspaces(userId?: string) {
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;
    const res = await fetch('/api/auth/workspaces', { headers });
    return res.json();
  },

  async createWorkspace(userId: string, data: any) {
    const res = await fetch('/api/auth/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getStorageConnections(userId?: string) {
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;
    const res = await fetch('/api/auth/storage/connections', { headers });
    return res.json();
  },

  async saveStorageConnection(userId: string, data: any) {
    const res = await fetch('/api/auth/storage/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async testStorageConnection(data: any) {
    const res = await fetch('/api/auth/storage/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

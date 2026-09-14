/**
 * @file remoteAuthClient.ts
 * @description Remote Authentication Client invoking Gateway.
 * Conforms to APP_ARCHITECTURE_SPEC Section 17 & < 200 lines.
 */

export class RemoteAuthClient {
  public async authenticate(credentials: Record<string, unknown>) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) throw new Error(`Remote auth failed: ${res.statusText}`);
    return res.json();
  }

  public async verify(token: string) {
    const res = await fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  public async revoke(sessionId: string) {
    const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
    return res.ok;
  }
}

export const remoteAuthClient = new RemoteAuthClient();

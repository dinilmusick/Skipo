import { describe, expect, it, vi } from 'vitest';
import { createEcosystemRuntime } from '../scaffolds/vite/src/backend/ecosystem/generated/ecosystemRuntime_Impure.js';

describe('pending application enrollment', () => {
  const query = vi.fn(() => {
    throw new Error('pending applications must not access the deployment registry');
  });
  const runtime = createEcosystemRuntime({
    appId: '',
    registrationStatus: 'pending_enrollment',
    capabilities: { listWorkspaces: async () => [] },
    authenticate: async () => 'verified-user',
    query: query as never,
  });
  const env = { APP_URL: 'https://app.example', SYSTEM_DATABASE_URL: 'server-owned' } as never;

  it('does not create or refresh a deployment lease before admin approval', async () => {
    await runtime.heartbeat(env, true);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects inbound invocation before registry access', async () => {
    const response = await runtime.handle(new Request('https://app.example/api/ecosystem/invoke', {
      method: 'POST',
      headers: { 'x-skipo-invocation': '00000000-0000-4000-8000-000000000000' },
    }), env);

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ error: 'APP_ENROLLMENT_REQUIRED' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects outbound ecosystem calls before authentication or registry access', async () => {
    await expect(runtime.client(new Request('https://app.example'), env))
      .rejects.toThrow('Application enrollment is required');
    const client = runtime.serviceClient(env);
    await expect(client.aiko.listWorkspaces({})).rejects.toThrow('Application enrollment is required');
    expect(query).not.toHaveBeenCalled();
  });
});

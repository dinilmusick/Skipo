import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEcosystemRuntime } from '../scaffolds/vite/src/backend/ecosystem/generated/ecosystemRuntime_Impure.js';

afterEach(() => vi.restoreAllMocks());

describe('ecosystem runtime enrollment authority', () => {
  it('defaults to pending and performs no registry, authentication, or network work', async () => {
    const query = vi.fn(async () => {
      throw new Error('pending runtime must not query the registry');
    });
    const authenticate = vi.fn(async () => 'must-not-authenticate');
    const send = vi.fn(async () => new Response('{}'));
    const runtime = createEcosystemRuntime({
      appId: 'aiko',
      capabilities: { listWorkspaces: async () => [] },
      authenticate,
      query: query as never,
      send,
    });
    const env = {
      APP_URL: 'https://aiko.example.test',
      SYSTEM_DATABASE_URL: 'postgresql://test-only',
    };

    await expect(runtime.heartbeat(env, true)).resolves.toBeUndefined();
    await expect(runtime.observe(env)).resolves.toBeUndefined();
    await expect(runtime.start(env)).resolves.toBeUndefined();

    const inbound = await runtime.handle(new Request(
      'https://aiko.example.test/api/ecosystem/invoke',
      { method: 'POST', headers: { 'x-skipo-invocation': '00000000-0000-4000-8000-000000000000' } },
    ), env);
    expect(inbound?.status).toBe(503);
    await expect(inbound?.json()).resolves.toEqual({ error: 'APP_ENROLLMENT_REQUIRED' });
    expect(inbound?.headers.get('cache-control')).toBe('no-store');

    await expect(runtime.client(new Request('https://aiko.example.test'), env))
      .rejects.toThrow('Application enrollment is required');
    const serviceClient = runtime.serviceClient(env);
    await expect(serviceClient.aiko.listWorkspaces({}))
      .rejects.toThrow('Application enrollment is required');

    expect(query).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not let a valid-looking app_id substitute for registry authority', async () => {
    const query = vi.fn(async () => []);
    const runtime = createEcosystemRuntime({
      appId: 'aiko',
      capabilities: {},
      authenticate: async () => null,
      query: query as never,
    });
    await runtime.heartbeat({
      APP_URL: 'https://aiko.example.test',
      SYSTEM_DATABASE_URL: 'postgresql://test-only',
    }, true);
    expect(query).not.toHaveBeenCalled();
  });
});

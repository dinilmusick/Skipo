import { describe, expect, it } from 'vitest';
import { defineGuestWorkspaceStoreConformance } from './guest-workspace-store.conformance.js';
import {
  createGuestWorkspaceAuthorityHandler,
  HttpGuestWorkspaceStore,
  InMemoryGuestWorkspaceAuthority,
} from '../src/guest/GuestWorkspaceAuthority.js';

const SERVICE_TOKEN = 'guest-authority-test-token-'.padEnd(64, 'x');

function createPair() {
  const authority = new InMemoryGuestWorkspaceAuthority(() => 1_000);
  const handler = createGuestWorkspaceAuthorityHandler({ serviceToken: SERVICE_TOKEN, authority });
  const transport: typeof fetch = async (input, init) => handler(new Request(input, init));
  return {
    first: new HttpGuestWorkspaceStore({
      endpoint: 'https://guest-authority.test',
      serviceToken: SERVICE_TOKEN,
      fetch: transport,
    }),
    second: new HttpGuestWorkspaceStore({
      endpoint: 'https://guest-authority.test',
      serviceToken: SERVICE_TOKEN,
      fetch: transport,
    }),
  };
}

defineGuestWorkspaceStoreConformance('HTTP volatile guest authority', createPair);

describe('guest workspace volatile authority boundary', () => {
  it('rejects calls without the private service token', async () => {
    const authority = new InMemoryGuestWorkspaceAuthority(() => 1_000);
    const handler = createGuestWorkspaceAuthorityHandler({ serviceToken: SERVICE_TOKEN, authority });
    const response = await handler(new Request('https://guest-authority.test/v1/guest-workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'createNamespace', namespace: 'forged', expiresAt: 2_000,
        limits: { maxConcurrentLeases: 1 } }),
    }));
    expect(response.status).toBe(401);
    expect(authority['namespaces' as keyof typeof authority]).toBeDefined();
  });

  it('fails closed after an authority process restart instead of recreating missing guest data', async () => {
    const firstAuthority = new InMemoryGuestWorkspaceAuthority(() => 1_000);
    const firstHandler = createGuestWorkspaceAuthorityHandler({ serviceToken: SERVICE_TOKEN, authority: firstAuthority });
    const firstFetch: typeof fetch = async (input, init) => firstHandler(new Request(input, init));
    const firstStore = new HttpGuestWorkspaceStore({
      endpoint: 'https://guest-authority.test', serviceToken: SERVICE_TOKEN, fetch: firstFetch,
    });
    await firstStore.createNamespace('guest/app/deployment/lease/workspace', 2_000, { maxConcurrentLeases: 2 });
    await firstStore.write('guest/app/deployment/lease/workspace', 'draft.txt',
      new TextEncoder().encode('temporary'), { maxBytes: 100, maxFiles: 2 });

    const restartedAuthority = new InMemoryGuestWorkspaceAuthority(() => 1_000);
    const restartedHandler = createGuestWorkspaceAuthorityHandler({ serviceToken: SERVICE_TOKEN, authority: restartedAuthority });
    const restartedFetch: typeof fetch = async (input, init) => restartedHandler(new Request(input, init));
    const restartedStore = new HttpGuestWorkspaceStore({
      endpoint: 'https://guest-authority.test', serviceToken: SERVICE_TOKEN, fetch: restartedFetch,
    });

    await expect(restartedStore.read('guest/app/deployment/lease/workspace', 'draft.txt'))
      .rejects.toMatchObject({ code: 'GUEST_WORKSPACE_UNAVAILABLE', status: 410 });
  });

  it('exposes only a non-sensitive volatile-mode health contract', async () => {
    const handler = createGuestWorkspaceAuthorityHandler({
      serviceToken: SERVICE_TOKEN,
      authority: new InMemoryGuestWorkspaceAuthority(),
    });
    const response = await handler(new Request('https://guest-authority.test/health'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      mode: 'volatile-memory',
      persistentWorkspace: false,
    });
  });
});

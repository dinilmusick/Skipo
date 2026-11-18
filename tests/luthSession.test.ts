import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ultrst-armada/kloks/auth', () => ({
  DEFAULT_LUTH_URL: 'https://luth.example.test',
}));

vi.mock('../scaffolds/vite/src/backend/ecosystem/appIdentity_Pure', () => ({
  appId: 'aiko',
}));

import { authenticateLuthRequest, proxyLuthAuthRequest } from '../scaffolds/vite/src/backend/auth/luthSession';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Skipo Vite canonical Luth boundary', () => {
  it('rejects requests without a Luth credential', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await authenticateLuthRequest(new Request('https://app.example.test/api/workspaces'));
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses verified Luth identity instead of caller-controlled identity headers', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      authenticated: true,
      user: { id: 'verified-user', email: 'verified@example.test' },
    }), { status: 200 })) as typeof fetch;

    const request = new Request('https://app.example.test/api/workspaces', {
      headers: {
        authorization: 'Bearer luth-session-token',
        'x-app-id': 'attacker-app',
        'x-user-id': 'attacker-user',
        'x-user-role': 'admin',
      },
    });
    const result = await authenticateLuthRequest(request);
    expect(result.status).toBeUndefined();
    const headers = new Headers(result.request?.headers);
    expect(headers.get('x-user-id')).toBe('verified-user');
    expect(headers.get('x-user-email')).toBe('verified@example.test');
    expect(headers.get('x-user-role')).toBe('user');
  });

  it('pins external and backend session checks to the configured app and strips forged optional identity headers', async () => {
    const seen: Headers[] = [];
    globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response(JSON.stringify({
        authenticated: true,
        user: { id: 'verified-user' },
        session: { id: 'verified-session' },
      }), { status: 200 });
    }) as typeof fetch;

    const request = new Request('https://app.example.test/api/workspaces', {
      headers: {
        authorization: 'Bearer valid-session',
        'x-app-id': 'attacker-app',
        'x-user-id': 'attacker-user',
        'x-user-email': 'attacker@example.test',
        'x-session-id': 'attacker-session',
        'x-user-role': 'admin',
      },
    });
    const result = await authenticateLuthRequest(request);
    expect(result.request).toBeDefined();
    expect(seen[0].get('x-app-id')).toBe('aiko');
    const forwarded = new Headers(result.request?.headers);
    expect(forwarded.get('x-app-id')).toBe('aiko');
    expect(forwarded.get('x-user-id')).toBe('verified-user');
    expect(forwarded.get('x-session-id')).toBe('verified-session');
    expect(forwarded.get('x-user-email')).toBeNull();
    expect(forwarded.get('x-user-role')).toBe('user');
  });

  it('does not let caller x-app-id select another app for direct Luth session checks', async () => {
    let headers: Headers | undefined;
    globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({
        authenticated: true, user: { id: 'verified-user' }, session: { id: 'verified-session' },
      }), { status: 200 });
    }) as typeof fetch;
    const request = new Request('https://app.example.test/api/workspaces', {
      headers: { authorization: 'Bearer token', 'x-app-id': 'attacker-app' },
    });
    const { getLuthSession } = await import('../scaffolds/vite/src/backend/auth/luthSession');
    expect(await getLuthSession(request)).toMatchObject({ authenticated: true });
    expect(headers?.get('x-app-id')).toBe('aiko');
  });

  it('does not authenticate static assets or public health requests', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const asset = await authenticateLuthRequest(new Request('https://app.example.test/assets/app.js'));
    const health = await authenticateLuthRequest(new Request('https://app.example.test/api/health'));
    expect(asset.request).toBeDefined();
    expect(health.request).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies compatibility login to Luth and binds the canonical application ID', async () => {
    let target = '';
    let headers: Headers | undefined;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      target = String(input);
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'set-auth-token': 'luth-token' },
      });
    }) as typeof fetch;

    const request = new Request('https://app.example.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.example.test' },
      body: JSON.stringify({ email: 'user@example.test', password: 'not-real' }),
    });
    const response = await proxyLuthAuthRequest(request);
    expect(target).toBe('https://luth.example.test/api/auth/sign-in/email');
    expect(headers?.get('x-app-id')).toBe('aiko');
    expect(response?.status).toBe(200);
    expect(response?.headers.get('set-auth-token')).toBe('luth-token');
  });

  it('never provides application-local administrator login', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const request = new Request('https://app.example.test/api/auth/admin/login', { method: 'POST' });
    const response = await proxyLuthAuthRequest(request);
    expect(response?.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

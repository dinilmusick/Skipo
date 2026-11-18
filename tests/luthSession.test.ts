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

  it('uses configured app identity and verified Luth principal instead of caller-controlled headers', async () => {
    const upstreamAppIds: string[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamAppIds.push(new Headers(init?.headers).get('x-app-id') || '');
      return new Response(JSON.stringify({
        authenticated: true,
        user: { id: 'verified-user', email: 'verified@example.test' },
      }), { status: 200 });
    }) as typeof fetch;

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
    expect(upstreamAppIds).toEqual(['aiko']);
    expect(headers.get('x-app-id')).toBe('aiko');
    expect(headers.get('x-user-id')).toBe('verified-user');
    expect(headers.get('x-user-email')).toBe('verified@example.test');
    expect(headers.get('x-user-role')).toBe('user');
  });

  it('drops caller-supplied email and session identity claims omitted by Luth', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      authenticated: true,
      user: { id: 'verified-user' },
    }), { status: 200 })) as typeof fetch;

    const request = new Request('https://app.example.test/api/workspaces', {
      headers: {
        authorization: 'Bearer luth-session-token',
        'x-app-id': 'attacker-app',
        'x-user-id': 'attacker-user',
        'x-user-email': 'attacker@example.test',
        'x-session-id': 'attacker-session',
        'x-user-role': 'admin',
      },
    });
    const result = await authenticateLuthRequest(request);
    const headers = new Headers(result.request?.headers);
    expect(headers.get('x-app-id')).toBe('aiko');
    expect(headers.get('x-user-id')).toBe('verified-user');
    expect(headers.get('x-user-role')).toBe('user');
    expect(headers.get('x-user-email')).toBeNull();
    expect(headers.get('x-session-id')).toBeNull();
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

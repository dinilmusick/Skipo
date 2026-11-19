import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ultrst-armada/kloks/auth', () => ({
  DEFAULT_LUTH_URL: 'https://luth.example.test',
  // The generated first-party browser client must never mint or store tokens.
  createApplicationAuthClient: () => ({
    startSignIn: vi.fn(), signInWithEmail: vi.fn(), getSession: vi.fn(), signOut: vi.fn(),
  }),
}));

import { authenticateLuthRequest, getLuthSession } from '../scaffolds/vite/src/backend/auth/luthSession';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Skipo canonical Luth API bearer boundary', () => {
  it('rejects uncredentialed protected requests without calling Luth', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await authenticateLuthRequest(new Request('https://app.example.test/api/workspaces', {
      headers: { 'x-user-id': 'forged', 'x-app-id': 'other-app' },
    }));
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never forwards app-origin cookies into the Luth session verifier', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const request = new Request('https://app.example.test/api/workspaces', {
      headers: { cookie: '__Host-ultrst_oidc_session=opaque; luth-session=unsafe', 'x-user-id': 'forged' },
    });
    expect((await authenticateLuthRequest(request)).status).toBe(401);
    expect(await getLuthSession(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('binds explicit bearer admission to the compiled app, not request-supplied identity', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const outgoing = new Headers(init?.headers);
      expect(outgoing.get('x-app-id')).toBe('my-app');
      expect(outgoing.get('authorization')).toBe('Bearer canonical-machine-token');
      expect(outgoing.has('cookie')).toBe(false);
      return Response.json({
        authenticated: true,
        user: { id: 'verified-user', email: 'verified@example.test' },
        session: { id: 'server-verified-session' },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const request = new Request('https://app.example.test/api/workspaces', {
      headers: {
        authorization: 'Bearer canonical-machine-token',
        cookie: 'foreign-app-cookie=do-not-forward',
        'x-app-id': 'attacker-app',
        'x-user-id': 'attacker-user',
        'x-user-email': 'attacker@example.test',
        'x-user-role': 'admin',
        'x-session-id': 'attacker-session',
      },
    });
    const result = await authenticateLuthRequest(request);
    expect(result.status).toBeUndefined();
    const headers = new Headers(result.request?.headers);
    expect(headers.get('x-user-id')).toBe('verified-user');
    expect(headers.get('x-user-email')).toBe('verified@example.test');
    expect(headers.get('x-session-id')).toBe('server-verified-session');
    expect(headers.get('x-user-role')).toBe('user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects expired/revoked sessions without trusting forged headers', async () => {
    const fetchMock = vi.fn(async () => Response.json({ authenticated: false }, { status: 401 }));
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await authenticateLuthRequest(new Request('https://app.example.test/api/workspaces', {
      headers: { authorization: 'Bearer revoked', 'x-user-id': 'forged' },
    }));
    expect(result.status).toBe(401);
    expect(result.request).toBeUndefined();
  });

  it('does not require bearer credentials for static files or public health routes', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const asset = await authenticateLuthRequest(new Request('https://app.example.test/assets/app.js'));
    const health = await authenticateLuthRequest(new Request('https://app.example.test/api/health'));
    expect(asset.request).toBeDefined();
    expect(health.request).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

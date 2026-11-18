import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ecosystem: {
    observe: vi.fn(async (_env?: unknown) => undefined),
    handle: vi.fn(async (_request: Request, _env?: unknown) => null as Response | null),
  },
  proxyLuthAuthRequest: vi.fn(async (_request: Request) => null as Response | null),
  authenticateLuthRequest: vi.fn(async (request: Request): Promise<{ request?: Request; status?: number; error?: string }> => {
    const headers = new Headers(request.headers);
    headers.set('x-user-id', 'owner-1');
    return { request: new Request(request, { headers }) };
  }),
  handleUiSessionRequest: vi.fn(async (_request: Request, _options: unknown) => null as Response | null),
  listWorkspaces: vi.fn(async (_userId: string, _env?: unknown) => ({ workspaces: [{ id: 'workspace-1' }] })),
  createWorkspace: vi.fn(async (_userId: string, _workspace: unknown, _env?: unknown) => ({ id: 'workspace-1' })),
  invokeStorage: vi.fn(async (_userId: string, _operation: string, _input: unknown, _env?: unknown) => ({ ok: true })),
  completeGoogleDriveOAuth: vi.fn(async () => ({
    connectionId: 'drive-1',
    returnTo: 'https://app.test/workspaces',
  })),
  externalInterfaces: {
    mcp: vi.fn(async (_request: Request) => null as Response | null),
    http: vi.fn(async (_request: Request) => null as Response | null),
  },
}));

vi.mock('../scaffolds/vite/src/backend/ecosystem/AppEcosystem_Impure.js', () => ({
  ecosystem: mocks.ecosystem,
}));
vi.mock('../scaffolds/vite/src/backend/UniversalBackend.js', () => ({
  externalInterfaces: mocks.externalInterfaces,
}));
vi.mock('../scaffolds/vite/src/backend/auth/luthSession.js', () => ({
  proxyLuthAuthRequest: mocks.proxyLuthAuthRequest,
  authenticateLuthRequest: mocks.authenticateLuthRequest,
}));
vi.mock('@ultrst-armada/kloks/backend/ui-session', () => ({
  handleUiSessionRequest: mocks.handleUiSessionRequest,
}));
vi.mock('../scaffolds/vite/src/backend/storage/canonicalCapabilityRoutes.js', () => ({
  listWorkspaces: mocks.listWorkspaces,
  createWorkspace: mocks.createWorkspace,
  invokeStorage: mocks.invokeStorage,
  completeGoogleDriveOAuth: mocks.completeGoogleDriveOAuth,
}));

import { fetch as fetchApp } from '../scaffolds/vite/src/app.js';

describe('canonical generated application Fetch handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ecosystem.observe.mockResolvedValue(undefined);
    mocks.ecosystem.handle.mockResolvedValue(null);
    mocks.proxyLuthAuthRequest.mockResolvedValue(null);
    mocks.authenticateLuthRequest.mockImplementation(async (request: Request) => {
      const headers = new Headers(request.headers);
      headers.set('x-user-id', 'owner-1');
      return { request: new Request(request, { headers }) };
    });
    mocks.handleUiSessionRequest.mockResolvedValue(null);
    mocks.listWorkspaces.mockResolvedValue({ workspaces: [{ id: 'workspace-1' }] });
    mocks.createWorkspace.mockResolvedValue({ id: 'workspace-1' });
    mocks.invokeStorage.mockResolvedValue({ ok: true });
    mocks.completeGoogleDriveOAuth.mockResolvedValue({
      connectionId: 'drive-1',
      returnTo: 'https://app.test/workspaces',
    });
    mocks.externalInterfaces.mcp.mockResolvedValue(null);
    mocks.externalInterfaces.http.mockResolvedValue(null);
  });

  it('authenticates before listing workspaces and delegates to Kloks', async () => {
    const response = await fetchApp(new Request('https://app.test/api/workspaces'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspaces: [{ id: 'workspace-1' }] });
    expect(mocks.authenticateLuthRequest).toHaveBeenCalledOnce();
    expect(mocks.listWorkspaces).toHaveBeenCalledWith('owner-1', {});
  });

  it('fails closed when Luth rejects the session', async () => {
    mocks.authenticateLuthRequest.mockResolvedValueOnce({
      status: 401,
      error: 'Luth session is invalid or expired.',
    });
    const response = await fetchApp(new Request('https://app.test/api/storage/connections'));
    expect(response.status).toBe(401);
    expect(mocks.invokeStorage).not.toHaveBeenCalled();
  });

  it('keeps the Google Drive OAuth nonce in an HttpOnly cookie, not the response body', async () => {
    mocks.invokeStorage.mockResolvedValueOnce({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      nonce: 'nonce_value_which_is_long_enough_123',
      expiresAt: '2026-11-18T20:00:00.000Z',
    });
    const response = await fetchApp(new Request('https://app.test/api/storage/invoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'createGoogleDriveAuthorizationRequest',
        input: { callbackOrigin: 'https://app.test', returnTo: '/workspaces' },
      }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.authorizationUrl).toContain('accounts.google.com');
    expect(JSON.stringify(payload)).not.toContain('nonce_value');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('nonce_value_which_is_long_enough_123');
  });

  it('completes Google Drive OAuth and clears the one-time nonce cookie', async () => {
    const response = await fetchApp(new Request(
      'https://app.test/api/storage/google-drive/callback?state=signed-state&code=authorization-code',
      { headers: { cookie: 'skipo_google_drive_nonce=nonce_value_which_is_long_enough_123' } },
    ));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('googleDriveConnected=1');
    expect(response.headers.get('location')).toContain('googleDriveConnectionId=drive-1');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(mocks.completeGoogleDriveOAuth).toHaveBeenCalledWith(
      'owner-1',
      'signed-state',
      'nonce_value_which_is_long_enough_123',
      'authorization-code',
      'https://app.test',
      {},
    );
  });

  it('delegates MCP requests through the same Fetch entrypoint', async () => {
    const mcpResponse = new Response('mcp response');
    mocks.externalInterfaces.mcp.mockResolvedValueOnce(mcpResponse);
    const response = await fetchApp(new Request('https://app.test/mcp', { method: 'POST', body: '{}' }));
    expect(response).toBe(mcpResponse);
    expect(mocks.externalInterfaces.mcp).toHaveBeenCalledOnce();
  });

  it('serves static assets through the canonical handler', async () => {
    const assetsFetch = vi.fn(async () => new Response('index asset'));
    const response = await fetchApp(
      new Request('https://app.test/'),
      { ASSETS: { fetch: assetsFetch } },
    );
    expect(await response.text()).toBe('index asset');
    expect(assetsFetch).toHaveBeenCalledOnce();
    expect(mocks.externalInterfaces.mcp).not.toHaveBeenCalled();
  });
});

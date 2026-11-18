import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scaffolds/vite/src/backend/ecosystem/appIdentity_Pure', () => ({
  appId: 'aiko',
  appRegistrationStatus: 'registry_confirmation_required',
  appIdentityAuthorityVerified: false,
  deploymentId: null,
  oauthClientId: null,
  workspaceEnvironment: (env: Record<string, unknown> = {}) => {
    const { WORKSPACE_APP_ID: _untrustedAppId, SKIPO_DEPLOYMENT_ID: _untrustedDeploymentId,
      LUTH_OAUTH_CLIENT_ID: _untrustedOauthClientId, ...safeEnv } = env;
    return { ...safeEnv, WORKSPACE_APP_ID: 'aiko' };
  },
}));
import { WorkspaceServiceFacade, StorageServiceFacade } from '@ultrst-armada/kloks/backend/krnl-services';
import { fetchHandler } from '../scaffolds/vite/src/backend/adapters/httpsAdapter.js';
import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

afterEach(() => vi.restoreAllMocks());

function stubLuthSession(userId: string) {
  const originalFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).startsWith(`${DEFAULT_LUTH_URL}/api/session`)) {
      expect(new Headers(init?.headers).get('cookie')).toContain('luth-session=valid');
      return Response.json({
        authenticated: true,
        user: { id: userId, email: 'user@example.invalid' },
        session: { id: 'verified-session' },
      });
    }
    return originalFetch(input, init);
  });
}

describe('actual Vite Fetch ingress to canonical Kloks', () => {
  it('rejects forged identities without a Luth credential', async () => {
    const execute = vi.spyOn(WorkspaceServiceFacade, 'execute');
    const request = new Request('http://localhost:3000/api/auth/workspaces', {
      headers: { 'x-user-id': 'attacker' },
    });
    const response = await fetchHandler(request);
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('lists and creates workspaces with the verified owner, not the submitted owner', async () => {
    stubLuthSession('verified-luth-user');
    const execute = vi.spyOn(WorkspaceServiceFacade, 'execute')
      .mockResolvedValueOnce({ success: true, workspaces: [{ id: 'ws-1', name: 'Real workspace' }] } as never)
      .mockResolvedValueOnce({ success: true, workspace: { id: 'ws-2', name: 'Created' } } as never);

    const get = await fetchHandler(new Request('http://localhost:3000/api/auth/workspaces', {
      headers: { cookie: 'luth-session=valid', 'x-user-id': 'attacker' },
    }), { APP_URL: 'http://localhost:3000' });
    expect(get.status).toBe(200);
    expect((await get.json()).workspaces[0].name).toBe('Real workspace');
    expect(execute).toHaveBeenNthCalledWith(1, 'listWorkspaces', {
      userId: 'verified-luth-user', env: { APP_URL: 'http://localhost:3000', WORKSPACE_APP_ID: 'aiko' },
    });

    const post = await fetchHandler(new Request('http://localhost:3000/api/auth/workspaces', {
      method: 'POST',
      headers: { cookie: 'luth-session=valid', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Created', userId: 'attacker', storageProvider: 'local_fs' }),
    }));
    expect(post.status).toBe(201);
    expect((await post.json()).workspace.id).toBe('ws-2');
    expect(execute).toHaveBeenNthCalledWith(2, 'createWorkspace', {
      userId: 'verified-luth-user',
      workspace: { name: 'Created', storageProvider: 'local_fs' },
      env: { WORKSPACE_APP_ID: 'aiko' },
    });
  });

  it('blocks privileged storage RPC while allowing public connection discovery', async () => {
    stubLuthSession('verified-luth-user');
    const execute = vi.spyOn(StorageServiceFacade, 'execute')
      .mockResolvedValue({ connections: [] } as never);
    const forbidden = await fetchHandler(new Request('http://localhost:3000/api/auth/storage/invoke', {
      method: 'POST',
      headers: { cookie: 'luth-session=valid', 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'getConnectionsWithSecrets', input: {} }),
    }));
    expect(forbidden.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();

    const connections = await fetchHandler(new Request('http://localhost:3000/api/auth/storage/invoke', {
      method: 'POST',
      headers: { cookie: 'luth-session=valid', 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'getConnections', input: { userId: 'attacker' } }),
    }));
    expect(connections.status).toBe(200);
    expect(execute).toHaveBeenCalledWith('getConnections', { userId: 'verified-luth-user', env: { WORKSPACE_APP_ID: 'aiko' } });
  });
});


describe('Google Drive OAuth boundary over actual Vite ingress', () => {
  it('stores the canonical nonce server-side and returns the Kloks authorization URL', async () => {
    stubLuthSession('verified-luth-user');
    vi.spyOn(StorageServiceFacade, 'execute').mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth?state=signed',
      nonce: 'abcdefghijklmnopqrstuvwx12345678', state: 'signed',
    } as never);
    const response = await fetchHandler(new Request('http://localhost:3000/api/auth/storage/invoke', {
      method: 'POST', headers: { cookie: 'luth-session=valid', 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'createGoogleDriveAuthorizationRequest', input: {
        callbackOrigin: 'http://localhost:3000', returnTo: 'http://localhost:3000/',
      } }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('skipo_google_drive_nonce=abcdefghijklmnopqrstuvwx12345678');
    const payload = await response.json();
    expect(payload.authorizationUrl).toMatch(/^https:\/\/accounts.google.com/);
    expect(payload.nonce).toBeUndefined();
    expect(payload.state).toBeUndefined();
  });

  it('checks the signed state and Luth identity before exchanging the provider code', async () => {
    stubLuthSession('verified-luth-user');
    const execute = vi.spyOn(StorageServiceFacade, 'execute')
      .mockResolvedValueOnce({ userId: 'verified-luth-user', returnTo: 'http://localhost:3000/' } as never)
      .mockResolvedValueOnce({ id: 'connection-1' } as never);
    const response = await fetchHandler(new Request('http://localhost:3000/api/auth/storage/google-drive/callback?state=signed&code=code-1', {
      headers: { cookie: 'luth-session=valid; skipo_google_drive_nonce=abcdefghijklmnopqrstuvwx12345678' },
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('googleDriveConnectionId=connection-1');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(execute).toHaveBeenNthCalledWith(1, 'verifyGoogleDriveAuthorizationState', {
      state: 'signed', nonceCookie: 'abcdefghijklmnopqrstuvwx12345678', callbackOrigin: 'http://localhost:3000', env: {},
    });
    expect(execute).toHaveBeenNthCalledWith(2, 'completeGoogleDriveAuthorization', {
      userId: 'verified-luth-user', code: 'code-1', env: {},
    });
  });

  it('does not exchange an OAuth code when verified state names a different user', async () => {
    stubLuthSession('verified-luth-user');
    const execute = vi.spyOn(StorageServiceFacade, 'execute')
      .mockResolvedValue({ userId: 'someone-else', returnTo: 'http://localhost:3000/' } as never);
    const response = await fetchHandler(new Request('http://localhost:3000/api/auth/storage/google-drive/callback?state=signed&code=code-1', {
      headers: { cookie: 'luth-session=valid; skipo_google_drive_nonce=abcdefghijklmnopqrstuvwx12345678' },
    }));
    expect(response.status).toBe(400);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

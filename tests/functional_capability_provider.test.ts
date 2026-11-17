import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  StorageServiceFacade, WorkspaceServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import {
  buildWorkspaceCreateInput, createKloksWorkspaceStorageService, LuthAuthPage, WorkspaceTilesMenu,
} from '@ultrst-armada/floks/ui';
import * as next from '../scaffolds/nextjs/src/backend/storage/canonicalCapabilityRoutes.js';
import * as vite from '../scaffolds/vite/src/backend/storage/canonicalCapabilityRoutes.js';

afterEach(() => vi.restoreAllMocks());

describe('functional canonical providers from the actually installed packages', () => {
  it('uses real Kloks workspace validation rather than a locally invented implementation', async () => {
    const output = await WorkspaceServiceFacade.execute('validateWorkspaceConfig', {
      id: 'ws-1', name: 'My Workspace', storageType: 'local_fs', appName: 'Skipo', userName: 'test',
    }) as any;
    expect(output.valid).toBe(true);
    expect(output.workspaceId).toBe('ws-1');
    expect(output.name).toBe('My Workspace');
    expect(output.folderName).toContain('skipo');
  });

  it('uses real Kloks storage capability resolution without external credentials', async () => {
    const output = await StorageServiceFacade.execute('resolveAdapterType', { provider: 'google_drive' }) as any;
    expect(output.provider).toBe('google_drive');
    expect(output.provider).not.toBe('local_fs');
  });

  it('uses real Floks workspace creation payload semantics and exports', () => {
    expect(typeof LuthAuthPage).toBe('function');
    expect(typeof WorkspaceTilesMenu).toBe('function');
    expect(typeof createKloksWorkspaceStorageService).toBe('function');
    const payload = buildWorkspaceCreateInput('Example', 'a workspace', {
      id: 'connection-1', provider: 'backblaze_b2', label: 'B2', b2BucketName: 'bucket-one',
    });
    expect(payload.name).toBe('Example');
    expect(payload.storageProvider).toBe('backblaze_b2');
    expect(payload.storageConnectionId).toBe('connection-1');
    expect(payload.storage.b2BucketName).toBe('bucket-one');
    expect((payload as any).applicationKey).toBeUndefined();
  });
});

for (const [name, adapter] of [['Next.js', next], ['Vite', vite]] as const) {
  describe(`${name} Kloks HTTP adapter contracts`, () => {
    it('routes workspace retrieval and creation to actual facade operations', async () => {
      const execute = vi.spyOn(WorkspaceServiceFacade, 'execute').mockResolvedValue({ success: true, workspaces: [] } as never);
      await adapter.listWorkspaces('luth-principal');
      expect(execute).toHaveBeenCalledWith('listWorkspaces', { userId: 'luth-principal', env: undefined });
      await adapter.createWorkspace('luth-principal', { name: 'Created', storageProvider: 'local_fs' });
      expect(execute).toHaveBeenLastCalledWith('createWorkspace', {
        userId: 'luth-principal', workspace: { name: 'Created', storageProvider: 'local_fs' }, env: undefined,
      });
    });

    it('keeps browser credentials scoped to the verified principal', async () => {
      const execute = vi.spyOn(StorageServiceFacade, 'execute').mockResolvedValue({ success: true } as never);
      await adapter.invokeStorage('verified-luth-id', 'getConnections', {
        userId: 'forged-client-id', env: { SYSTEM_DATABASE_URL: 'forged' },
      }, { SYSTEM_DATABASE_URL: 'server-owned' });
      expect(execute).toHaveBeenCalledWith('getConnections', {
        userId: 'verified-luth-id', env: { SYSTEM_DATABASE_URL: 'server-owned' },
      });
    });

    it('fails closed for secret-revealing, unsupported or unauthenticated operations', async () => {
      const execute = vi.spyOn(StorageServiceFacade, 'execute');
      await expect(adapter.invokeStorage('luth-principal', 'getConnectionsWithSecrets', {})).rejects.toThrow();
      await expect(adapter.invokeStorage('luth-principal', 'persistGoogleDriveTokens', {})).rejects.toThrow();
      await expect(adapter.invokeStorage('', 'getConnections', {})).rejects.toThrow();
      await expect(adapter.createWorkspace('luth-principal', { id: 'empty' })).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    });
  });
}


describe('generation exercised by the published Skipo CLI entrypoint', () => {
  it('generates a workspace capability without placeholder data in an independent app', () => {
    execFileSync('python3', ['-m', 'pytest', '-q', '--import-mode=importlib', 'tests/functional_capability_generation.test.py'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  });
});

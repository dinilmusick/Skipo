/**
 * /api/auth/storage/connections
 *
 * User-Scoped Storage Connections Management.
 * Manages user's saved storage credentials (Backblaze B2, Cloudflare R2, AWS S3, Supabase, Local)
 * with Primary vs Redundant Clone role mechanism (mirroring the admin database cluster pattern).
 */

import { NextResponse } from 'next/server';
import { findUserByIdAsync, updateUserProfileAsync } from '@/lib/auth-storage';
import { maskStorageConnection, testStorageConnection } from '@/lib/storage-providers';
import { UserStorageConnection, UserWorkspaceRecord, DatabaseEngine } from '@/lib/types';
import { initializeCloudWorkspaceBucket } from '@/lib/cloud-storage-service';
import { setActiveVaultConfig } from '@/lib/workspaceFS';
import { extractCanonicalFolderPrefix } from '@/lib/workspace-canonical';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ensurePrimaryRole(connections: UserStorageConnection[]): UserStorageConnection[] {
  if (connections.length === 0) return [];
  const hasExplicitPrimary = connections.some((c) => c.role === 'primary');
  if (hasExplicitPrimary) return connections;

  const cloudIdx = connections.findIndex((c) => c.provider !== 'local_fs');
  const targetIdx = cloudIdx >= 0 ? cloudIdx : 0;

  return connections.map((conn, idx) => ({
    ...conn,
    role: idx === targetIdx ? 'primary' : 'redundant_clone',
    enabled: conn.enabled !== undefined ? conn.enabled : true,
  }));
}

export const GET = createSecureRoute({
  id: 'api-auth-storage-connections-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { session }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const rawConnections: UserStorageConnection[] =
      user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
    const normalizedConnections = ensurePrimaryRole(rawConnections);
    const masked = normalizedConnections.map(maskStorageConnection);

    return NextResponse.json({
      success: true,
      connections: masked,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-auth-storage-connections-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 128 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = body || {};
    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const existingConnections: UserStorageConnection[] =
      user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];

    // Action: Set an existing connection as primary
    if (payload.action === 'set_primary' && payload.id) {
      const targetConn = existingConnections.find((c) => c.id === payload.id);
      if (!targetConn) {
        return NextResponse.json({ success: false, error: 'CONNECTION_NOT_FOUND' }, { status: 404 });
      }

      const updatedConnections: UserStorageConnection[] = existingConnections.map((c) => ({
        ...c,
        role: c.id === payload.id ? 'primary' : 'redundant_clone',
        enabled: c.id === payload.id ? true : c.enabled,
      }));

      const workspaces: UserWorkspaceRecord[] =
        user.appProfiles?.docustack?.workspaces || user.workspaces || [];
      const requestedWsId = payload.workspaceId || req.headers.get('x-workspace-id');
      const activeWsId = requestedWsId || user.appProfiles?.docustack?.activeWorkspaceId || user.activeWorkspaceId;
      const targetWs = workspaces.find((w) => w.id === activeWsId) || workspaces[0];

      let updatedWorkspaces = workspaces;
      let cleanWsPath = targetWs?.workspacePath || '';
      if (targetWs) {
        const engine: DatabaseEngine = targetConn.provider === 'local_fs' ? 'local_fs' : 's3_blob';
        const folderPrefix = extractCanonicalFolderPrefix(
          targetWs.workspacePath,
          user.username || user.name || 'user',
          targetWs.name || 'workspace'
        );
        cleanWsPath = targetConn.provider === 'local_fs' ? (targetWs.workspacePath || `./${folderPrefix}`) : `./${folderPrefix}`;

        updatedWorkspaces = workspaces.map((w) =>
          w.id === targetWs.id
            ? {
                ...w,
                workspacePath: cleanWsPath,
                storageConnectionId: targetConn.id,
                storageProvider: targetConn.provider,
                engine,
              }
            : w
        );

        setActiveVaultConfig(cleanWsPath, targetWs.name, { ...targetConn, role: 'primary' }, folderPrefix);

        if (targetConn.provider !== 'local_fs') {
          initializeCloudWorkspaceBucket(
            targetConn,
            folderPrefix,
            targetWs.name,
            user.name || user.username || 'User'
          ).catch((e) => console.warn('[CloudStorage] Bucket init on set_primary warning:', e));
        }
      }

      const updatedAppProfiles = {
        ...(user.appProfiles || {}),
        docustack: {
          ...(user.appProfiles?.docustack || {}),
          storage_connections: updatedConnections,
          workspaces: updatedWorkspaces,
        },
      };

      const updatedUser = await updateUserProfileAsync(session.userId, {
        appProfiles: updatedAppProfiles,
        workspaces: updatedWorkspaces,
        storage_connections: updatedConnections,
        ...(targetWs ? { workspacePath: cleanWsPath } : {}),
      } as any);

      const { passwordHash: _, ...safeUser } = (updatedUser || {}) as any;

      return NextResponse.json({
        success: true,
        message: `STORAGE_ELEVATED_TO_PRIMARY: ${targetConn.label || targetConn.provider}`,
        connections: updatedConnections.map(maskStorageConnection),
        user: safeUser,
      });
    }

    // Creating or Updating a Storage Connection
    if (!payload || !payload.provider) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PROVIDER: provider is required.' },
        { status: 400 }
      );
    }

    const connectionId = payload.id || `conn_${payload.provider}_${Date.now()}`;
    const targetIdx = existingConnections.findIndex((c) => c.id === connectionId);
    const existing = targetIdx >= 0 ? existingConnections[targetIdx] : undefined;

    const isMaskedOrEmpty = (str?: string) => !str || str.includes('•');
    const hydratedBody: UserStorageConnection = {
      ...payload,
      id: connectionId,
      b2ApplicationKey: isMaskedOrEmpty(payload.b2ApplicationKey) && existing ? existing.b2ApplicationKey : payload.b2ApplicationKey,
      r2SecretAccessKey: isMaskedOrEmpty(payload.r2SecretAccessKey) && existing ? existing.r2SecretAccessKey : payload.r2SecretAccessKey,
      s3SecretAccessKey: isMaskedOrEmpty(payload.s3SecretAccessKey) && existing ? existing.s3SecretAccessKey : payload.s3SecretAccessKey,
      supabaseAnonKey: isMaskedOrEmpty(payload.supabaseAnonKey) && existing ? existing.supabaseAnonKey : payload.supabaseAnonKey,
      supabaseServiceKey: isMaskedOrEmpty(payload.supabaseServiceKey) && existing ? existing.supabaseServiceKey : payload.supabaseServiceKey,
    };

    let testStatus: 'ok' | 'failed' = 'ok';
    let testError: string | undefined = undefined;
    let latencyMs: number | undefined = undefined;

    if (hydratedBody.provider !== 'local_fs') {
      const probe = await testStorageConnection(hydratedBody);
      testStatus = probe.ok ? 'ok' : 'failed';
      testError = probe.error;
      latencyMs = probe.latencyMs;
    }

    const willBePrimary =
      payload.role === 'primary' ||
      existingConnections.length === 0 ||
      (existing && existing.role === 'primary');

    const newOrUpdatedConn: UserStorageConnection = {
      ...hydratedBody,
      label: payload.label?.trim() || existing?.label || `${payload.provider.toUpperCase()} Vault`,
      role: willBePrimary ? 'primary' : payload.role || 'redundant_clone',
      enabled: payload.enabled !== undefined ? payload.enabled : true,
      createdAt: payload.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testedAt: new Date().toISOString(),
      testStatus,
      testError,
      latencyMs,
    };

    let updatedList: UserStorageConnection[];
    if (targetIdx >= 0) {
      updatedList = [...existingConnections];
      updatedList[targetIdx] = newOrUpdatedConn;
    } else {
      updatedList = [...existingConnections, newOrUpdatedConn];
    }

    if (willBePrimary) {
      updatedList = updatedList.map((c) =>
        c.id === newOrUpdatedConn.id ? { ...c, role: 'primary' } : { ...c, role: 'redundant_clone' }
      );
    } else {
      updatedList = ensurePrimaryRole(updatedList);
    }

    const workspaces: UserWorkspaceRecord[] =
      user.appProfiles?.docustack?.workspaces || user.workspaces || [];
    const requestedWsId = payload.workspaceId || req.headers.get('x-workspace-id');
    const activeWsId = requestedWsId || user.appProfiles?.docustack?.activeWorkspaceId || user.activeWorkspaceId;
    const targetWs = workspaces.find((w) => w.id === activeWsId) || workspaces[0];

    let updatedWorkspaces = workspaces;
    let cleanWsPath = targetWs?.workspacePath || '';
    if (willBePrimary && targetWs) {
      const engine: DatabaseEngine = newOrUpdatedConn.provider === 'local_fs' ? 'local_fs' : 's3_blob';
      const folderPrefix = extractCanonicalFolderPrefix(
        targetWs.workspacePath,
        user.username || user.name || 'user',
        targetWs.name || 'workspace'
      );
      cleanWsPath = newOrUpdatedConn.provider === 'local_fs' ? (targetWs.workspacePath || `./${folderPrefix}`) : `./${folderPrefix}`;
      updatedWorkspaces = workspaces.map((w) =>
        w.id === targetWs.id
          ? {
              ...w,
              workspacePath: cleanWsPath,
              storageConnectionId: newOrUpdatedConn.id,
              storageProvider: newOrUpdatedConn.provider,
              engine,
            }
          : w
      );

      setActiveVaultConfig(cleanWsPath, targetWs.name, newOrUpdatedConn, folderPrefix);

      if (newOrUpdatedConn.provider !== 'local_fs' && testStatus === 'ok') {
        initializeCloudWorkspaceBucket(
          newOrUpdatedConn,
          folderPrefix,
          targetWs.name,
          user.name || user.username || 'User'
        ).catch((e) => console.warn('[CloudStorage] Auto bucket init on save warning:', e));
      }
    }

    const updatedAppProfiles = {
      ...(user.appProfiles || {}),
      docustack: {
        ...(user.appProfiles?.docustack || {}),
        storage_connections: updatedList,
        workspaces: updatedWorkspaces,
      },
    };

    const updatedUser = await updateUserProfileAsync(session.userId, {
      appProfiles: updatedAppProfiles,
      workspaces: updatedWorkspaces,
      storage_connections: updatedList,
      ...(willBePrimary && targetWs ? { workspacePath: cleanWsPath } : {}),
    } as any);

    const { passwordHash: _, ...safeUser } = (updatedUser || {}) as any;

    return NextResponse.json({
      success: true,
      connection: maskStorageConnection(newOrUpdatedConn),
      testResult: { ok: testStatus === 'ok', latencyMs, error: testError },
      user: safeUser,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-auth-storage-connections-put',
  method: 'PUT',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 128 * 1024, maxExecutionMs: 20000 },
  handler: async (req, ctx) => {
    return (POST as any)(req, ctx);
  },
});

export const DELETE = createSecureRoute({
  id: 'api-auth-storage-connections-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { session, query }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const connectionId = query.get('id');
    if (!connectionId) {
      return NextResponse.json({ success: false, error: 'MISSING_CONNECTION_ID' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const existingConnections: UserStorageConnection[] =
      user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
    const removedConn = existingConnections.find((c) => c.id === connectionId);
    let updatedList = existingConnections.filter((c) => c.id !== connectionId);

    if (removedConn?.role === 'primary' && updatedList.length > 0) {
      updatedList = ensurePrimaryRole(updatedList);
    }

    const workspaces: UserWorkspaceRecord[] =
      user.appProfiles?.docustack?.workspaces || user.workspaces || [];
    const newPrimary = updatedList.find((c) => c.role === 'primary');
    const updatedWorkspaces = workspaces.map((w) => {
      if (w.storageConnectionId === connectionId) {
        return {
          ...w,
          storageConnectionId: newPrimary?.id || undefined,
          storageProvider: newPrimary?.provider || 'local_fs',
          engine: (newPrimary && newPrimary.provider !== 'local_fs' ? 's3_blob' : 'local_fs') as DatabaseEngine,
        };
      }
      return w;
    });

    const updatedAppProfiles = {
      ...(user.appProfiles || {}),
      docustack: {
        ...(user.appProfiles?.docustack || {}),
        storage_connections: updatedList,
        workspaces: updatedWorkspaces,
      },
    };

    const updatedUser = await updateUserProfileAsync(session.userId, {
      appProfiles: updatedAppProfiles,
      storage_connections: updatedList,
      workspaces: updatedWorkspaces,
    } as any);

    const { passwordHash: _, ...safeUser } = updatedUser || ({} as any);

    return NextResponse.json({
      success: true,
      message: 'CONNECTION_REMOVED',
      user: safeUser,
      connections: updatedList.map(maskStorageConnection),
    });
  },
});

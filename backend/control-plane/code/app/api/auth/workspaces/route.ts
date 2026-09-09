import { NextResponse } from 'next/server';
import {
  findUserByIdAsync,
  loadUsers,
  getUserWorkspacesAsync,
  addUserWorkspaceAsync,
  updateUserWorkspaceAsync,
  deleteUserWorkspaceAsync,
  switchActiveWorkspaceAsync,
} from '@/lib/auth-storage';
import fs from 'fs';
import { setActiveVaultConfig, ensureWorkspaceExists, getVaultAbsolutePath, globalActiveFolderPrefix } from '@/lib/workspaceFS';
import { initializeCloudWorkspaceBucket, deleteCloudWorkspaceFolder, getSafeCloudFolderName } from '@/lib/cloud-storage-service';
import { UserStorageConnection } from '@/lib/types';
import { formatCanonicalWorkspaceFolderName, sanitizeFolderSegment } from '@/lib/workspace-canonical';
import { buildS3Client } from '@/lib/storage-providers';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-auth-workspaces-get',
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

    const workspaces = await getUserWorkspacesAsync(session.userId);

    return NextResponse.json({
      success: true,
      workspaces,
      activeWorkspaceId: user.activeWorkspaceId || workspaces[0]?.id,
      count: workspaces.length,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-auth-workspaces-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 256 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = body || {};
    const {
      name,
      engine,
      description,
      icon,
      storageSettings,
      isDefault,
      storageConnectionId,
      storageProvider,
      localFolderName,
      localFolderKey,
    } = payload;

    if (!name) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_NAME_REQUIRED' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    const userConns: UserStorageConnection[] =
      user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
    const primaryConn =
      userConns.find((c) => c.role === 'primary') ||
      userConns.find((c) => c.provider !== 'local_fs') ||
      userConns[0] ||
      null;

    const effectiveStorageConnId = storageConnectionId || primaryConn?.id;
    const effectiveStorageProvider = storageProvider || primaryConn?.provider || 'local_fs';
    const effectiveEngine = engine || (effectiveStorageProvider !== 'local_fs' ? 's3_blob' : 'local_fs');

    const newWs = await addUserWorkspaceAsync(session.userId, {
      name,
      engine: effectiveEngine,
      workspacePath: '', // Derived automatically in addUserWorkspaceAsync
      description: description || '',
      icon: icon || 'hard-drive',
      storageConnectionId: effectiveStorageConnId,
      storageProvider: effectiveStorageProvider,
      localFolderName: localFolderName || primaryConn?.localFolderName,
      localFolderKey: localFolderKey || primaryConn?.localFolderKey,
      storageSettings: storageSettings || {
        engine: effectiveEngine,
        activeProfileName: name,
        autoSync: true,
        status: 'connected',
        local_fs: { autoScanSubfolders: true, maxFileSizeMb: 250 },
      },
      isDefault: isDefault || false,
    });

    const freshUser = await findUserByIdAsync(session.userId);
    const freshUserConns: UserStorageConnection[] =
      freshUser?.appProfiles?.docustack?.storage_connections || (freshUser as any)?.storage_connections || [];
    let storageConn = effectiveStorageConnId ? freshUserConns.find((c: any) => c.id === effectiveStorageConnId) : null;
    if (!storageConn && payload.storageConnection) {
      storageConn = payload.storageConnection;
    }
    if (!storageConn) {
      storageConn = primaryConn;
    }
    const folderPrefix = newWs.workspacePath ? newWs.workspacePath.replace(/^\.\//, '') : '';

    if (newWs.workspacePath) {
      setActiveVaultConfig(newWs.workspacePath, newWs.name, storageConn, folderPrefix);
      ensureWorkspaceExists(newWs.workspacePath);
    }

    let cloudInitStatus: { initialized: boolean; count: number; error?: string } = { initialized: false, count: 0 };
    const cloudTargets: UserStorageConnection[] = [];
    if (storageConn && storageConn.provider !== 'local_fs') {
      cloudTargets.push(storageConn);
    }
    const combinedConns = [
      ...freshUserConns,
      ...(Array.isArray(payload.storageConnections) ? payload.storageConnections : []),
    ];
    for (const c of combinedConns) {
      if (
        c &&
        c.provider !== 'local_fs' &&
        !cloudTargets.some((t) => t.id === c.id || (t.provider === c.provider && t.b2BucketName === c.b2BucketName))
      ) {
        cloudTargets.push(c);
      }
    }

    for (const target of cloudTargets) {
      try {
        await initializeCloudWorkspaceBucket(
          target,
          folderPrefix,
          newWs.name,
          freshUser?.name || freshUser?.username || 'User'
        );
        cloudInitStatus.initialized = true;
        cloudInitStatus.count++;
      } catch (cloudErr: any) {
        console.error(`[CloudStorage] Failed to initialize cloud storage bucket on conn ${target.id}:`, cloudErr);
        if (!cloudInitStatus.error) {
          cloudInitStatus.error = cloudErr?.message || 'Failed to initialize cloud storage bucket';
        }
      }
    }

    const { passwordHash: _, ...safeUser } = freshUser || ({} as any);

    publishRealtimeEvent({
      userId: session.userId,
      workspaceId: newWs.id,
      source: 'api',
      method: 'POST',
      endpoint: '/api/auth/workspaces',
      action: 'WORKSPACE_UPDATED',
      details: `Created workspace "${newWs.name}"`,
      payload: { action: 'CREATED', workspace: newWs },
    });

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_CREATED',
      workspace: newWs,
      user: safeUser,
      cloudInit: cloudInitStatus,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-auth-workspaces-put',
  method: 'PUT',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 256 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = body || {};
    const { workspaceId, action, updates } = payload;

    if (action === 'switch' && workspaceId) {
      const activeWs = await switchActiveWorkspaceAsync(session.userId, workspaceId);
      const user = await findUserByIdAsync(session.userId);
      const userConns: UserStorageConnection[] =
        user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
      const storageConn = activeWs.storageConnectionId
        ? userConns.find((c: any) => c.id === activeWs.storageConnectionId)
        : null;
      const folderPrefix = activeWs.workspacePath ? activeWs.workspacePath.replace(/^\.\//, '') : '';

      if (activeWs.workspacePath) {
        setActiveVaultConfig(activeWs.workspacePath, activeWs.name, storageConn, folderPrefix);
        ensureWorkspaceExists(activeWs.workspacePath);
      }
      const { passwordHash: _, ...safeUser } = user || ({} as any);

      publishRealtimeEvent({
        userId: session.userId,
        workspaceId: activeWs.id,
        source: 'api',
        method: 'PUT',
        endpoint: '/api/auth/workspaces',
        action: 'WORKSPACE_SWITCHED',
        details: `Switched active workspace to "${activeWs.name}"`,
        payload: { action: 'SWITCHED', activeWorkspace: activeWs },
      });

      return NextResponse.json({
        success: true,
        message: 'WORKSPACE_ACTIVATED',
        activeWorkspace: activeWs,
        user: safeUser,
      });
    }

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_ID_REQUIRED' }, { status: 400 });
    }

    const updatesToApply = updates || {
      ...(payload.storageConnectionId !== undefined ? { storageConnectionId: payload.storageConnectionId } : {}),
      ...(payload.storageProvider !== undefined ? { storageProvider: payload.storageProvider } : {}),
      ...(payload.engine !== undefined ? { engine: payload.engine } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.localFolderName !== undefined ? { localFolderName: payload.localFolderName } : {}),
      ...(payload.localFolderKey !== undefined ? { localFolderKey: payload.localFolderKey } : {}),
      ...(payload.storageSettings !== undefined ? { storageSettings: payload.storageSettings } : {}),
    };
    const updated = await updateUserWorkspaceAsync(session.userId, workspaceId, updatesToApply);
    const user = await findUserByIdAsync(session.userId);
    const userConns =
      user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
    const storageConn = updated.storageConnectionId
      ? userConns.find((c: any) => c.id === updated.storageConnectionId)
      : null;
    const folderPrefix = updated.workspacePath ? updated.workspacePath.replace(/^\.\//, '') : '';

    if (updated.workspacePath) {
      setActiveVaultConfig(updated.workspacePath, updated.name, storageConn, folderPrefix);
      ensureWorkspaceExists(updated.workspacePath);
    }

    if (storageConn && storageConn.provider !== 'local_fs') {
      try {
        await initializeCloudWorkspaceBucket(
          storageConn,
          folderPrefix,
          updated.name,
          user?.name || user?.username || 'User'
        );
      } catch (cloudErr) {
        console.warn('[CloudStorage] Failed to initialize cloud storage bucket on update:', cloudErr);
      }
    }
    const { passwordHash: _, ...safeUser } = user || ({} as any);

    publishRealtimeEvent({
      userId: session.userId,
      workspaceId: updated.id,
      source: 'api',
      method: 'PUT',
      endpoint: '/api/auth/workspaces',
      action: 'WORKSPACE_UPDATED',
      details: `Updated workspace "${updated.name}"`,
      payload: { action: 'UPDATED', workspace: updated },
    });

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_UPDATED',
      workspace: updated,
      user: safeUser,
    });
  },
});

export const DELETE = createSecureRoute({
  id: 'api-auth-workspaces-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 128 * 1024, maxExecutionMs: 20000 },
  handler: async (req, { session, body, query }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = body || {};
    let workspaceId = query.get('id') || query.get('workspaceId') || payload.workspaceId || payload.id;
    let extraCandidatePrefixes: string[] = payload.candidatePrefixes || [];
    let extraStorageConnections: any[] = payload.storageConnections || [];
    let bodyWorkspaceName = payload.workspaceName || payload.name || '';
    let bodyWorkspacePath = payload.workspacePath || '';

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_ID_REQUIRED' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    const localDbUser = loadUsers().find((u) => u.id === session.userId);

    const userWorkspaces: any[] = [
      ...(user?.workspaces || []),
      ...(user?.appProfiles?.docustack?.workspaces || []),
      ...(localDbUser?.workspaces || []),
      ...(localDbUser?.appProfiles?.docustack?.workspaces || []),
    ];
    const targetWs = userWorkspaces.find((w: any) => w.id === workspaceId);

    const userName = user?.username || user?.name || (user?.email ? user.email.split('@')[0] : 'user');
    const wsName = targetWs?.name || bodyWorkspaceName || '';
    const rawWsPath = targetWs?.workspacePath
      ? targetWs.workspacePath.replace(/^\.\//, '')
      : (bodyWorkspacePath ? bodyWorkspacePath.replace(/^\.\//, '') : '');

    const candidatePrefixes = Array.from(
      new Set(
        [
          rawWsPath,
          rawWsPath ? rawWsPath.toLowerCase() : '',
          wsName ? formatCanonicalWorkspaceFolderName('docustack', userName, wsName) : '',
          wsName ? formatCanonicalWorkspaceFolderName('DocuStack', userName, wsName) : '',
          wsName ? `ultrst_docustack_${userName}_${wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}` : '',
          wsName ? `ultrst_docustack_${userName}_${getSafeCloudFolderName(wsName)}` : '',
          wsName ? wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_') : '',
          wsName ? getSafeCloudFolderName(wsName) : '',
          wsName,
          ...extraCandidatePrefixes,
        ].filter(Boolean) as string[]
      )
    );

    const dbConns: any[] = [
      ...(user?.appProfiles?.docustack?.storage_connections || []),
      ...((user as any)?.storage_connections || []),
      ...(localDbUser?.appProfiles?.docustack?.storage_connections || []),
      ...((localDbUser as any)?.storage_connections || []),
      ...extraStorageConnections,
    ];

    const isSecretValid = (str?: string) => Boolean(str && str.trim().length > 0 && !str.includes('•'));

    const cloudConnsMap = new Map<string, UserStorageConnection>();
    for (const conn of dbConns) {
      if (!conn || conn.provider === 'local_fs') continue;
      const key = `${conn.provider}_${conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName || conn.id}`;

      const hasValidSecret =
        (conn.provider === 'backblaze_b2' && isSecretValid(conn.b2ApplicationKey)) ||
        (conn.provider === 'cloudflare_r2' && isSecretValid(conn.r2SecretAccessKey)) ||
        (conn.provider === 'aws_s3' && isSecretValid(conn.s3SecretAccessKey)) ||
        (conn.provider === 'supabase_storage' && (isSecretValid(conn.supabaseServiceKey) || isSecretValid(conn.supabaseAnonKey)));

      const existing = cloudConnsMap.get(key);
      if (!existing) {
        cloudConnsMap.set(key, conn);
      } else {
        const existingHasValid =
          (existing.provider === 'backblaze_b2' && isSecretValid(existing.b2ApplicationKey)) ||
          (existing.provider === 'cloudflare_r2' && isSecretValid(existing.r2SecretAccessKey)) ||
          (existing.provider === 'aws_s3' && isSecretValid(existing.s3SecretAccessKey)) ||
          (existing.provider === 'supabase_storage' && (isSecretValid(existing.supabaseServiceKey) || isSecretValid(existing.supabaseAnonKey)));

        if (!existingHasValid && hasValidSecret) {
          cloudConnsMap.set(key, conn);
        }
      }
    }

    for (const [key, conn] of cloudConnsMap.entries()) {
      if (conn.provider === 'backblaze_b2' && !isSecretValid(conn.b2ApplicationKey)) {
        const unmaskedMatch = dbConns.find(
          (c) => c.provider === 'backblaze_b2' && isSecretValid(c.b2ApplicationKey) && (c.b2BucketName === conn.b2BucketName || c.b2KeyId === conn.b2KeyId)
        );
        if (unmaskedMatch) {
          cloudConnsMap.set(key, { ...conn, b2ApplicationKey: unmaskedMatch.b2ApplicationKey });
        }
      } else if (conn.provider === 'aws_s3' && !isSecretValid(conn.s3SecretAccessKey)) {
        const unmaskedMatch = dbConns.find(
          (c) => c.provider === 'aws_s3' && isSecretValid(c.s3SecretAccessKey) && c.s3BucketName === conn.s3BucketName
        );
        if (unmaskedMatch) {
          cloudConnsMap.set(key, { ...conn, s3SecretAccessKey: unmaskedMatch.s3SecretAccessKey });
        }
      } else if (conn.provider === 'cloudflare_r2' && !isSecretValid(conn.r2SecretAccessKey)) {
        const unmaskedMatch = dbConns.find(
          (c) => c.provider === 'cloudflare_r2' && isSecretValid(c.r2SecretAccessKey) && c.r2BucketName === conn.r2BucketName
        );
        if (unmaskedMatch) {
          cloudConnsMap.set(key, { ...conn, r2SecretAccessKey: unmaskedMatch.r2SecretAccessKey });
        }
      }
    }

    const cloudConns = Array.from(cloudConnsMap.values());

    for (const cloudConn of cloudConns) {
      if (cloudConn.provider === 'backblaze_b2' || cloudConn.provider === 'cloudflare_r2' || cloudConn.provider === 'aws_s3') {
        try {
          const { s3, bucketName } = buildS3Client(cloudConn);
          const listRes: any = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Delimiter: '/' }));
          const common = (listRes.CommonPrefixes || []).map((cp: any) => cp.Prefix?.replace(/\/$/, '')).filter(Boolean);
          const cleanTarget = wsName ? sanitizeFolderSegment(wsName) : '';
          for (const prefix of common) {
            const pLower = prefix.toLowerCase();
            if (
              (rawWsPath && pLower === rawWsPath.toLowerCase()) ||
              (cleanTarget && (pLower.endsWith(`_${cleanTarget}`) || pLower === cleanTarget))
            ) {
              if (!candidatePrefixes.includes(prefix)) {
                candidatePrefixes.push(prefix);
              }
            }
          }
        } catch (discErr) {
          console.warn(`[CloudStorage] Dynamic prefix discovery error on ${cloudConn.provider}:`, discErr);
        }
      }
    }

    for (const cloudConn of cloudConns) {
      for (const prefix of candidatePrefixes) {
        try {
          console.log(`[CloudStorage] Permanently purging workspace prefix "${prefix}" from provider "${cloudConn.provider}"`);
          await deleteCloudWorkspaceFolder(cloudConn, prefix, '');
        } catch (cloudErr) {
          console.warn(`[CloudStorage] Failed to purge prefix "${prefix}" from "${cloudConn.provider}":`, cloudErr);
        }
      }
    }

    for (const prefix of candidatePrefixes) {
      try {
        const vaultPath = getVaultAbsolutePath(prefix);
        if (fs.existsSync(vaultPath)) {
          fs.rmSync(vaultPath, { recursive: true, force: true });
        }
      } catch (fsErr) {
        console.warn('[workspaceFS] Failed to remove local workspace directory on delete:', fsErr);
      }
    }

    if (globalActiveFolderPrefix && candidatePrefixes.includes(globalActiveFolderPrefix)) {
      setActiveVaultConfig('', 'DocuStack Vault', null, null);
    }

    await deleteUserWorkspaceAsync(session.userId, workspaceId);

    const updatedUser = await findUserByIdAsync(session.userId);
    const { passwordHash: _, ...safeUser } = updatedUser || ({} as any);

    publishRealtimeEvent({
      userId: session.userId,
      workspaceId: workspaceId,
      source: 'api',
      method: 'DELETE',
      endpoint: '/api/auth/workspaces',
      action: 'WORKSPACE_UPDATED',
      details: `Deleted workspace "${wsName || workspaceId}"`,
      payload: { action: 'DELETED', workspaceId },
    });

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_DELETED',
      user: safeUser,
      purgedPrefixes: candidatePrefixes,
      purgedCloudCount: cloudConns.length,
    });
  },
});

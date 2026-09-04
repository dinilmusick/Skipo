import { NextRequest, NextResponse } from 'next/server';
import {
  verifySession,
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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      engine,
      workspacePath,
      description,
      icon,
      storageSettings,
      isDefault,
      storageConnectionId,
      storageProvider,
      localFolderName,
      localFolderKey,
    } = body;

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

    // Re-fetch updated user record to ensure active workspace id and state are in sync
    const freshUser = await findUserByIdAsync(session.userId);
    const freshUserConns: UserStorageConnection[] =
      freshUser?.appProfiles?.docustack?.storage_connections || (freshUser as any)?.storage_connections || [];
    let storageConn = effectiveStorageConnId ? freshUserConns.find((c: any) => c.id === effectiveStorageConnId) : null;
    if (!storageConn && body.storageConnection) {
      storageConn = body.storageConnection;
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
    // Direct End-to-End initialization on ALL user-owned cloud buckets (Backblaze B2, R2, S3, Supabase)
    const cloudTargets: UserStorageConnection[] = [];
    if (storageConn && storageConn.provider !== 'local_fs') {
      cloudTargets.push(storageConn);
    }
    for (const c of freshUserConns) {
      if (c && c.provider !== 'local_fs' && !cloudTargets.some((t) => t.id === c.id)) {
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

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_CREATED',
      workspace: newWs,
      user: safeUser,
      cloudInit: cloudInitStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, action, updates } = body;

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
      ...(body.storageConnectionId !== undefined ? { storageConnectionId: body.storageConnectionId } : {}),
      ...(body.storageProvider !== undefined ? { storageProvider: body.storageProvider } : {}),
      ...(body.engine !== undefined ? { engine: body.engine } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.localFolderName !== undefined ? { localFolderName: body.localFolderName } : {}),
      ...(body.localFolderKey !== undefined ? { localFolderKey: body.localFolderKey } : {}),
      ...(body.storageSettings !== undefined ? { storageSettings: body.storageSettings } : {}),
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

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_UPDATED',
      workspace: updated,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let workspaceId = searchParams.get('id') || searchParams.get('workspaceId');
    let extraCandidatePrefixes: string[] = [];
    let extraStorageConnections: any[] = [];
    let bodyWorkspaceName = '';
    let bodyWorkspacePath = '';

    // Also support JSON body payload if provided
    try {
      const body = await req.json();
      if (body?.workspaceId) workspaceId = body.workspaceId;
      if (body?.id) workspaceId = body.id;
      if (body?.workspaceName) bodyWorkspaceName = body.workspaceName;
      if (body?.name) bodyWorkspaceName = body.name;
      if (body?.workspacePath) bodyWorkspacePath = body.workspacePath;
      if (Array.isArray(body?.candidatePrefixes)) extraCandidatePrefixes = body.candidatePrefixes;
      if (Array.isArray(body?.storageConnections)) extraStorageConnections = body.storageConnections;
    } catch {}

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_ID_REQUIRED' }, { status: 400 });
    }

    // 1. Fetch user to locate target workspace and its storage config before deleting
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

    // 2. Gather all possible candidate folder prefixes used by this workspace
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

    // 3. Aggregate all user cloud connections (Backblaze B2, Cloudflare R2, AWS S3, Supabase)
    // Prioritize authentic, unmasked credentials stored in database
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

    // Attempt credential rehydration for any connection that is still masked
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

    // 4. Dynamic prefix discovery: List root folders in bucket to find any matching prefixes
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

    // 5. Permanently purge all candidate prefixes from ALL connected cloud buckets (Backblaze B2, R2, S3)
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

    // 6. Clean up local workspace directories on server disk if present
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

    // 7. Reset active vault config if deleting the current active workspace
    if (globalActiveFolderPrefix && candidatePrefixes.includes(globalActiveFolderPrefix)) {
      setActiveVaultConfig('', 'DocuStack Vault', null, null);
    }

    await deleteUserWorkspaceAsync(session.userId, workspaceId);

    const updatedUser = await findUserByIdAsync(session.userId);
    const { passwordHash: _, ...safeUser } = updatedUser || ({} as any);

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_DELETED',
      user: safeUser,
      purgedPrefixes: candidatePrefixes,
      purgedCloudCount: cloudConns.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

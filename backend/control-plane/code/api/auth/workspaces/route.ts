import { NextRequest, NextResponse } from 'next/server';
import {
  verifySession,
  findUserByIdAsync,
  getUserWorkspacesAsync,
  addUserWorkspaceAsync,
  updateUserWorkspaceAsync,
  deleteUserWorkspaceAsync,
  switchActiveWorkspaceAsync,
} from '@/lib/auth-storage';
import fs from 'fs';
import { setActiveVaultConfig, ensureWorkspaceExists, getVaultAbsolutePath } from '@/lib/workspaceFS';
import { initializeCloudWorkspaceBucket, deleteCloudWorkspaceFolder } from '@/lib/cloud-storage-service';
import { UserStorageConnection } from '@/lib/types';
import { formatCanonicalWorkspaceFolderName } from '@/lib/workspace-canonical';

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

    const newWs = await addUserWorkspaceAsync(session.userId, {
      name,
      engine: engine || 'local_fs',
      workspacePath: '', // Derived automatically in addUserWorkspaceAsync
      description: description || '',
      icon: icon || 'hard-drive',
      storageConnectionId,
      storageProvider,
      localFolderName,
      localFolderKey,
      storageSettings: storageSettings || {
        engine: engine || 'local_fs',
        activeProfileName: name,
        autoSync: true,
        status: 'connected',
        local_fs: { autoScanSubfolders: true, maxFileSizeMb: 250 },
      },
      isDefault: isDefault || false,
    });

    const user = await findUserByIdAsync(session.userId);
    const userConns: UserStorageConnection[] =
      user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
    let storageConn = storageConnectionId ? userConns.find((c: any) => c.id === storageConnectionId) : null;
    if (!storageConn && body.storageConnection) {
      storageConn = body.storageConnection;
    }
    if (!storageConn && userConns.length > 0 && engine === 's3_blob') {
      storageConn = userConns[0];
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
    for (const c of userConns) {
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
          user?.name || user?.username || 'User'
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

    const { passwordHash: _, ...safeUser } = user || ({} as any);

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

    // Also support JSON body payload if provided
    try {
      const body = await req.json();
      if (body?.workspaceId) workspaceId = body.workspaceId;
      if (body?.id) workspaceId = body.id;
      if (Array.isArray(body?.candidatePrefixes)) extraCandidatePrefixes = body.candidatePrefixes;
      if (Array.isArray(body?.storageConnections)) extraStorageConnections = body.storageConnections;
    } catch {}

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_ID_REQUIRED' }, { status: 400 });
    }

    // 1. Fetch user to locate target workspace and its storage config before deleting
    const user = await findUserByIdAsync(session.userId);
    const targetWs = (user?.workspaces || []).find((w: any) => w.id === workspaceId);

    const userName = user?.username || user?.name || (user?.email ? user.email.split('@')[0] : 'user');
    const wsName = targetWs?.name || '';
    const rawWsPath = targetWs?.workspacePath ? targetWs.workspacePath.replace(/^\.\//, '') : '';

    // 2. Gather all possible candidate folder prefixes used by this workspace
    const candidatePrefixes = Array.from(
      new Set(
        [
          rawWsPath,
          wsName ? formatCanonicalWorkspaceFolderName('docustack', userName, wsName) : '',
          wsName ? formatCanonicalWorkspaceFolderName('DocuStack', userName, wsName) : '',
          wsName ? `ultrst_docustack_${userName}_${wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}` : '',
          `ultrst_docustack_${userName}_vault`,
          `ultrst_docustack_${userName}_docustack_vault`,
          `docustack_vault`,
          `vault`,
          wsName ? wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_') : '',
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
    ];

    const cloudConnsMap = new Map<string, UserStorageConnection>();
    for (const conn of dbConns) {
      if (!conn || conn.provider === 'local_fs') continue;
      // Skip masked connections if unmasked exists
      const isMasked = conn.b2ApplicationKey === '••••••••' || conn.s3SecretAccessKey === '••••••••';
      if (isMasked) continue;
      const key = `${conn.provider}_${conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName || conn.id}`;
      if (!cloudConnsMap.has(key)) {
        cloudConnsMap.set(key, conn);
      }
    }

    // Fallback: If map is empty, use any non-local_fs db connection
    if (cloudConnsMap.size === 0) {
      for (const conn of dbConns) {
        if (!conn || conn.provider === 'local_fs') continue;
        const key = `${conn.provider}_${conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName || conn.id}`;
        if (!cloudConnsMap.has(key)) cloudConnsMap.set(key, conn);
      }
    }

    const cloudConns = Array.from(cloudConnsMap.values());

    // 4. Permanently purge all candidate prefixes from ALL connected cloud buckets (Backblaze B2, R2, S3)
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

    // 5. Clean up local workspace directories on server disk if present
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

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
import { setActiveVaultConfig, ensureWorkspaceExists } from '@/lib/workspaceFS';
import { initializeCloudWorkspaceBucket } from '@/lib/cloud-storage-service';
import { UserStorageConnection } from '@/lib/types';

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

    let cloudInitStatus: { initialized: boolean; error?: string } = { initialized: false };
    // Direct End-to-End initialization on user-owned cloud bucket (Backblaze B2, R2, S3, Supabase)
    if (storageConn && storageConn.provider !== 'local_fs') {
      try {
        await initializeCloudWorkspaceBucket(
          storageConn,
          folderPrefix,
          newWs.name,
          user?.name || user?.username || 'User'
        );
        cloudInitStatus.initialized = true;
      } catch (cloudErr: any) {
        console.error('[CloudStorage] Failed to initialize cloud storage bucket on creation:', cloudErr);
        cloudInitStatus.error = cloudErr?.message || 'Failed to initialize cloud storage bucket';
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

    const updated = await updateUserWorkspaceAsync(session.userId, workspaceId, updates || {});
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
    const workspaceId = searchParams.get('id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_ID_REQUIRED' }, { status: 400 });
    }

    await deleteUserWorkspaceAsync(session.userId, workspaceId);

    const user = await findUserByIdAsync(session.userId);
    const { passwordHash: _, ...safeUser } = user || ({} as any);

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_DELETED',
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

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
    const { name, engine, workspacePath, description, icon, storageSettings, isDefault } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'WORKSPACE_NAME_REQUIRED' }, { status: 400 });
    }

    const newWs = await addUserWorkspaceAsync(session.userId, {
      name,
      engine: engine || 'local_fs',
      workspacePath: workspacePath || './docustack_vault',
      description: description || '',
      icon: icon || 'hard-drive',
      storageSettings: storageSettings || {
        engine: engine || 'local_fs',
        activeProfileName: name,
        autoSync: true,
        status: 'connected',
        local_fs: { vaultPath: workspacePath || './docustack_vault', autoScanSubfolders: true, maxFileSizeMb: 250 },
      },
      isDefault: isDefault || false,
    });

    if (newWs.workspacePath) {
      setActiveVaultConfig(newWs.workspacePath, newWs.name);
      ensureWorkspaceExists(newWs.workspacePath);
    }

    const user = await findUserByIdAsync(session.userId);
    const { passwordHash: _, ...safeUser } = user || ({} as any);

    return NextResponse.json({
      success: true,
      message: 'WORKSPACE_CREATED',
      workspace: newWs,
      user: safeUser,
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
      if (activeWs.workspacePath) {
        setActiveVaultConfig(activeWs.workspacePath, activeWs.name);
        ensureWorkspaceExists(activeWs.workspacePath);
      }
      const user = await findUserByIdAsync(session.userId);
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
    if (updated.workspacePath) {
      setActiveVaultConfig(updated.workspacePath, updated.name);
      ensureWorkspaceExists(updated.workspacePath);
    }

    const user = await findUserByIdAsync(session.userId);
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

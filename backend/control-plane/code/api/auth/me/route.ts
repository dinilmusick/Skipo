import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync, updateUserProfileAsync } from '@/lib/auth-storage';
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

    if (user.workspacePath) {
      setActiveVaultConfig(user.workspacePath, user.workspaceName);
    }

    const { passwordHash: _, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { workspacePath, workspaceName, name, avatarGlyph, username, workspaces, activeWorkspaceId } = body;

    const updates: any = {};
    if (workspacePath !== undefined) updates.workspacePath = workspacePath;
    if (workspaceName !== undefined) updates.workspaceName = workspaceName;
    if (name !== undefined) updates.name = name;
    if (avatarGlyph !== undefined) updates.avatarGlyph = avatarGlyph;
    if (username !== undefined) updates.username = username;
    if (workspaces !== undefined) updates.workspaces = workspaces;
    if (activeWorkspaceId !== undefined) updates.activeWorkspaceId = activeWorkspaceId;

    const updated = await updateUserProfileAsync(session.userId, updates);

    if (updated.workspacePath) {
      setActiveVaultConfig(updated.workspacePath, updated.workspaceName);
      ensureWorkspaceExists(updated.workspacePath);
    }

    const { passwordHash: _, ...safeUser } = updated;

    return NextResponse.json({
      success: true,
      message: 'PROFILE_WORKSPACE_UPDATED',
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}



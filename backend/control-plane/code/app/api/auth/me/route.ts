import { NextResponse } from 'next/server';
import { findUserByIdAsync, updateUserProfileAsync, resolveRequestContextVault } from '@/lib/auth-storage';
import { setActiveVaultConfig, ensureWorkspaceExists } from '@/lib/workspaceFS';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-auth-me-get',
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

    await resolveRequestContextVault(req);

    const { passwordHash: _, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-auth-me-put',
  method: 'PUT',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = body || {};
    const { workspacePath, workspaceName, name, avatarGlyph, username, workspaces, activeWorkspaceId } = payload;

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
  },
});

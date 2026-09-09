import { NextResponse } from 'next/server';
import { enforceAdminGuard, persistUserToCluster, deleteUserFromCluster } from '@/lib/control-plane';
import { loadUsersAsync } from '@/lib/auth-storage';
import { UserRole } from '@/lib/types';
import { logAdminEvent } from '@/lib/audit-logger';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-admin-users-get',
  method: 'GET',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const users = await loadUsersAsync();
    const sanitized = users.map(({ passwordHash: _, ...u }) => u);

    return NextResponse.json({
      success: true,
      users: sanitized,
      total: sanitized.length,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-admin-users-put',
  method: 'PUT',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { body }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized || !guard.session) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const { userId, role, workspacePath, workspaceName, name } = body || {};
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const users = await loadUsersAsync();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (role && (role === 'admin' || role === 'user' || role === 'pro')) {
      users[idx].role = role as UserRole;
      if (role === 'admin') users[idx].avatarGlyph = '⚡';
      else if (role === 'pro') users[idx].avatarGlyph = '💎';
      else users[idx].avatarGlyph = '👤';
    }

    if (workspacePath !== undefined) {
      users[idx].workspacePath = workspacePath;
    }

    if (workspaceName !== undefined) {
      users[idx].workspaceName = workspaceName;
    }

    if (name) {
      users[idx].name = name;
    }

    await persistUserToCluster(users[idx]);

    logAdminEvent({
      actor_user_id: guard.session.userId,
      action: 'USER_UPDATE',
      target_type: 'user',
      target_id: userId,
      details: `Updated user [${users[idx].email}] role=${role}`,
    });

    const { passwordHash: _, ...safeUser } = users[idx];
    return NextResponse.json({
      success: true,
      user: safeUser,
      message: `User [${safeUser.email}] updated successfully in Control Plane.`,
    });
  },
});

export const DELETE = createSecureRoute({
  id: 'api-admin-users-delete',
  method: 'DELETE',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { query }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized || !guard.session) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const userId = query.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const users = await loadUsersAsync();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (target.role === 'admin' && adminCount <= 1) {
      return NextResponse.json({
        success: false,
        error: 'SAFETY GUARD: Cannot delete the sole remaining Administrator account.',
      }, { status: 400 });
    }

    await deleteUserFromCluster(userId);

    logAdminEvent({
      actor_user_id: guard.session.userId,
      action: 'USER_DELETE',
      target_type: 'user',
      target_id: userId,
      details: `Deleted account [${target.email}]`,
    });

    return NextResponse.json({
      success: true,
      message: `User [${target.email}] removed from Control Plane registry.`,
    });
  },
});

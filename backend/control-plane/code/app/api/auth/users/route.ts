import { NextResponse } from 'next/server';
import { loadUsersAsync, findUserByIdAsync } from '@/lib/auth-storage';
import { persistUserToCluster, deleteUserFromCluster } from '@/lib/control-plane';
import { UserRole } from '@/lib/types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-auth-users-get',
  method: 'GET',
  auth: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async () => {
    const users = await loadUsersAsync();
    const safeUsers = users.map((u) => {
      const { passwordHash: _, ...safe } = u;
      return safe;
    });

    return NextResponse.json({
      success: true,
      total: safeUsers.length,
      users: safeUsers,
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-auth-users-put',
  method: 'PUT',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (_req, { body }) => {
    const { userId, role, workspacePath, workspaceName, name } = body || {};
    if (!userId) {
      return NextResponse.json({ success: false, error: 'MISSING_USER_ID' }, { status: 400 });
    }

    const users = await loadUsersAsync();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    if (role && ['admin', 'pro', 'user'].includes(role)) {
      users[idx].role = role as UserRole;
    }
    if (workspacePath !== undefined) {
      users[idx].workspacePath = workspacePath;
    }
    if (workspaceName !== undefined) {
      users[idx].workspaceName = workspaceName;
    }
    if (name !== undefined) {
      users[idx].name = name;
    }

    await persistUserToCluster(users[idx]);

    const { passwordHash: _, ...safe } = users[idx];

    return NextResponse.json({
      success: true,
      message: 'USER_PROFILE_UPDATED',
      user: safe,
    });
  },
});

export const DELETE = createSecureRoute({
  id: 'api-auth-users-delete',
  method: 'DELETE',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (_req, { query }) => {
    const userId = query.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'MISSING_USER_ID' }, { status: 400 });
    }

    const users = await loadUsersAsync();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    await deleteUserFromCluster(userId);
    return NextResponse.json({ success: true, message: 'USER_REMOVED_SUCCESSFULLY', purgedId: userId });
  },
});


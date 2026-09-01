import { NextRequest, NextResponse } from 'next/server';
import { loadUsersAsync, saveUsers, findUserByIdAsync } from '@/lib/auth-storage';
import { persistUserToCluster, deleteUserFromCluster } from '@/lib/control-plane';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, role, workspacePath, workspaceName, name } = await req.json();
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

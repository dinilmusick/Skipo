import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync } from '@/lib/auth-storage';
import { UserStorageConnection } from '@/lib/types';
import { deleteStorageObject, sanitizeStorageKey } from '@/lib/storage/presigner';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, relativePath, objectKey: directKey, connectionId } = body;

    if (!workspaceId && !directKey) {
      return NextResponse.json({ success: false, error: 'MISSING_PARAMETERS' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const userConns: UserStorageConnection[] =
      user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];

    let conn = connectionId ? userConns.find((c) => c.id === connectionId) : null;
    if (!conn) {
      conn = userConns.find((c) => c.role === 'primary' || c.provider !== 'local_fs') || userConns[0];
    }

    if (!conn || conn.provider === 'local_fs') {
      return NextResponse.json(
        { success: false, error: 'NO_ACTIVE_CLOUD_STORAGE_CONNECTION' },
        { status: 400 }
      );
    }

    const effectiveKey = directKey || sanitizeStorageKey(workspaceId, relativePath);
    await deleteStorageObject(conn, effectiveKey);

    return NextResponse.json({
      success: true,
      message: 'STORAGE_OBJECT_DELETED',
      objectKey: effectiveKey,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

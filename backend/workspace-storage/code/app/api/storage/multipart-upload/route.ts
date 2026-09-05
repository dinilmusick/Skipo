import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync } from '@/lib/auth-storage';
import { UserStorageConnection } from '@/lib/types';
import { initiateMultipartUpload, getMultipartPartUrl, sanitizeStorageKey } from '@/lib/storage/presigner';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, relativePath, contentType, partCount = 1, uploadId, partNumber, connectionId } = body;

    if (!workspaceId || !relativePath) {
      return NextResponse.json({ success: false, error: 'MISSING_PARAMETERS' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    const userConns: UserStorageConnection[] =
      user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];

    const conn = (connectionId ? userConns.find((c) => c.id === connectionId) : null) ||
      userConns.find((c) => c.role === 'primary' || c.provider !== 'local_fs') || userConns[0];

    if (!conn || conn.provider === 'local_fs') {
      return NextResponse.json({ success: false, error: 'NO_ACTIVE_CLOUD_STORAGE_CONNECTION' }, { status: 400 });
    }

    const objectKey = sanitizeStorageKey(workspaceId, relativePath);

    // If partNumber and uploadId are specified, return signed URL for specific chunk
    if (uploadId && partNumber) {
      const partUrl = await getMultipartPartUrl(conn, objectKey, uploadId, partNumber);
      return NextResponse.json({ success: true, partUrl, partNumber, uploadId });
    }

    // Otherwise initiate multipart upload
    const init = await initiateMultipartUpload(conn, objectKey, contentType || 'application/octet-stream');
    return NextResponse.json({ success: true, ...init });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

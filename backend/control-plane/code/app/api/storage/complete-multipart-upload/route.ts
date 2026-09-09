import { NextResponse } from 'next/server';
import { findUserByIdAsync } from '@/lib/auth-storage';
import { UserStorageConnection } from '@/lib/types';
import { completeMultipartUpload, sanitizeStorageKey } from '@/lib/storage/presigner';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-storage-complete-multipart-upload',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 128 * 1024 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { workspaceId, relativePath, objectKey: directKey, uploadId, parts, connectionId } = body || {};

    if (!uploadId || !Array.isArray(parts) || (!workspaceId && !directKey)) {
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

    const effectiveKey = directKey || sanitizeStorageKey(workspaceId, relativePath);
    await completeMultipartUpload(conn, effectiveKey, uploadId, parts);

    return NextResponse.json({
      success: true,
      message: 'MULTIPART_UPLOAD_COMPLETED',
      objectKey: effectiveKey,
    });
  },
});

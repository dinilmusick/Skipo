import { NextResponse } from 'next/server';
import { findUserByIdAsync } from '@/lib/auth-storage';
import { UserStorageConnection } from '@/lib/types';
import { createPresignedUploadUrl, sanitizeStorageKey } from '@/lib/storage/presigner';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-storage-upload-url',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 32 * 1024 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { workspaceId, relativePath, contentType, maxSizeBytes, connectionId } = body || {};

    if (!workspaceId || !relativePath) {
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

    const objectKey = sanitizeStorageKey(workspaceId, relativePath);
    const result = await createPresignedUploadUrl({
      conn,
      objectKey,
      contentType: contentType || 'application/octet-stream',
      maxSizeBytes: maxSizeBytes || 100 * 1024 * 1024,
      expiresInSeconds: 900,
    });

    return NextResponse.json({
      success: true,
      ...result,
      provider: conn.provider,
    });
  },
});

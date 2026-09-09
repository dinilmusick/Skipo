import { NextResponse } from 'next/server';
import { loadAllMedia, saveAllMedia, detectMediaType } from '@/lib/media-storage';
import { MediaItem } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-media-complete-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { session, body }) => {
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const {
      workspaceId,
      objectKey,
      fileName,
      mimeType,
      size,
      hash,
      description = '',
      tags = [],
    } = body || {};

    if (!objectKey || !fileName) {
      return NextResponse.json({ success: false, error: 'MISSING_MEDIA_METADATA' }, { status: 400 });
    }

    const mediaType = detectMediaType(mimeType || 'application/octet-stream', fileName);
    const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newMedia: MediaItem = {
      id: mediaId,
      userId: session.userId,
      fileName: objectKey.split('/').pop() || fileName,
      originalName: fileName,
      fileSize: size || 0,
      fileSizeFormatted: formatBytes(size || 0),
      mimeType: mimeType || 'application/octet-stream',
      mediaType,
      url: `/api/media/${mediaId}?userId=${encodeURIComponent(session.userId)}`,
      uploadedAt: new Date().toISOString(),
      tags: tags.length > 0 ? tags : ['MEDIA', mediaType.toUpperCase()],
      description,
    };

    (newMedia as any).objectKey = objectKey;
    (newMedia as any).workspaceId = workspaceId;
    (newMedia as any).hash = hash;

    const all = loadAllMedia();
    all.unshift(newMedia);
    saveAllMedia(all);

    return NextResponse.json(
      {
        success: true,
        message: 'MEDIA_METADATA_RECORDED',
        media: newMedia,
      },
      { status: 201 }
    );
  },
});

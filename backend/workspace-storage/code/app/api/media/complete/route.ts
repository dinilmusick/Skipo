import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync } from '@/lib/auth-storage';
import { loadAllMedia, saveAllMedia, detectMediaType } from '@/lib/media-storage';
import { MediaItem } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const {
      workspaceId,
      objectKey,
      fileName,
      mimeType,
      size,
      hash,
      description = '',
      tags = [],
    } = body;

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

    // Attach objectKey property for direct B2 retrieval
    (newMedia as any).objectKey = objectKey;
    (newMedia as any).workspaceId = workspaceId;
    (newMedia as any).hash = hash;

    const all = loadAllMedia();
    all.unshift(newMedia);
    saveAllMedia(all);

    return NextResponse.json({
      success: true,
      message: 'MEDIA_METADATA_RECORDED',
      media: newMedia,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

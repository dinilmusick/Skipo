import { NextResponse } from 'next/server';
import { loadAllMedia, getMediaByUserId, saveMediaFile, deleteMediaItem } from '@/lib/media-storage';
import { findUserById, loadUsers } from '@/lib/auth-storage';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-media-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { session, query }) => {
    const userId = query.get('userId') || session?.userId;
    const type = query.get('type');

    let media = userId ? getMediaByUserId(userId) : loadAllMedia();
    if (type) {
      media = media.filter((m) => m.mediaType === type);
    }

    return NextResponse.json({
      success: true,
      total: media.length,
      media,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-media-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 20 * 1024 * 1024 }, // 20MB max media file upload
  handler: async (req, { session }) => {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let userId = (formData.get('userId') as string) || session?.userId || '';
    const description = (formData.get('description') as string) || '';
    const tagsRaw = (formData.get('tags') as string) || '';
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

    if (!file) {
      return NextResponse.json({ success: false, error: 'NO_FILE_PROVIDED' }, { status: 400 });
    }

    if (!userId) {
      const users = loadUsers();
      userId = users[0]?.id || 'user-demo-03';
    }

    const user = findUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'INVALID_USER' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const savedMedia = saveMediaFile(userId, file.name, buffer, file.type || 'application/octet-stream', tags, description);

    return NextResponse.json(
      {
        success: true,
        message: 'MEDIA_UPLOAD_STORED_SUCCESSFULLY',
        media: savedMedia,
      },
      { status: 201 }
    );
  },
});

export const DELETE = createSecureRoute({
  id: 'api-media-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { session, query }) => {
    const id = query.get('id');
    const userId = query.get('userId') || session?.userId;

    if (!id) {
      return NextResponse.json({ success: false, error: 'MISSING_MEDIA_ID' }, { status: 400 });
    }

    deleteMediaItem(id, userId);

    return NextResponse.json({
      success: true,
      message: 'MEDIA_ITEM_PURGED',
      purgedId: id,
    });
  },
});

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getVaultAbsolutePath } from '@/lib/workspaceFS';
import { loadAllMedia } from '@/lib/media-storage';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-media-item-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params, query, session }) => {
    const id = params.id;
    const userId = query.get('userId') || session?.userId;

    const allMedia = loadAllMedia();
    const mediaItem = allMedia.find((m) => m.fileName === id || m.id === id);

    const vaultPath = getVaultAbsolutePath();
    let targetPath = '';

    if (mediaItem) {
      targetPath = path.join(vaultPath, 'media', mediaItem.userId, mediaItem.fileName);
    } else if (userId) {
      targetPath = path.join(vaultPath, 'media', userId, id);
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      return NextResponse.json({ success: false, error: 'MEDIA_FILE_NOT_FOUND' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(targetPath);
    const mimeType = mediaItem?.mimeType || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
});

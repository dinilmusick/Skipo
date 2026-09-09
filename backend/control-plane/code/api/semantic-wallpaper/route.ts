import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { findBestSemanticWallpaper } from '@/lib/wallpaper-nlp';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-semantic-wallpaper',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'EXPENSIVE_OPERATION' },
  limits: {
    maxBodySize: 64 * 1024,
    maxExecutionMs: 10000,
    maxConcurrency: 5,
  },
  handler: async (req, { body }) => {
    const { title, description } = body || {};
    const query = [title || '', description || ''].join(' ').trim();

    const dirPath = path.join(process.cwd(), 'public', 'wallpapers');
    let availableFiles: string[] = [];
    if (fs.existsSync(dirPath)) {
      availableFiles = fs
        .readdirSync(dirPath)
        .filter((f) => /\.(webm|mp4|gif|png|jpe?g|webp|svg)$/i.test(f));
    }

    const match = findBestSemanticWallpaper(query, availableFiles);
    return NextResponse.json({
      success: true,
      wallpaper: match.filename,
      label: match.label,
      confidence: match.confidence,
    });
  },
});

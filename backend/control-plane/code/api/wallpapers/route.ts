import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getVaultAbsolutePath,
  getRootVaultWallpaperRelativePath,
  saveVaultWallpaperFile,
  deleteVaultWallpaperFile,
  ensureWorkspaceExists,
} from '@/lib/workspaceFS';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.ogg': return 'video/ogg';
    case '.mov': return 'video/quicktime';
    case '.gif': return 'image/gif';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

export const GET = createSecureRoute({
  id: 'api-wallpapers-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    ensureWorkspaceExists();
    const vaultPath = getVaultAbsolutePath();
    const requestedPath = req.nextUrl.searchParams.get('path');

    if (requestedPath) {
      let fullPath = path.normalize(path.join(vaultPath, requestedPath));
      if (!fullPath.startsWith(vaultPath) || !fs.existsSync(fullPath)) {
        const publicPath = path.join(process.cwd(), 'public', 'wallpapers', path.basename(requestedPath));
        if (fs.existsSync(publicPath)) {
          fullPath = publicPath;
        } else {
          return NextResponse.json({ error: 'WALLPAPER_NOT_FOUND' }, { status: 404 });
        }
      }

      const buffer = fs.readFileSync(fullPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(fullPath),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const rootRelative = getRootVaultWallpaperRelativePath();
    const rootWallpaperUrl = rootRelative ? `/api/wallpapers?path=${encodeURIComponent(rootRelative)}&t=${Date.now()}` : null;

    let publicWallpapers: string[] = [];
    const publicDir = path.join(process.cwd(), 'public', 'wallpapers');
    if (fs.existsSync(publicDir)) {
      publicWallpapers = fs.readdirSync(publicDir).filter((f) => /\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f));
    }

    return NextResponse.json({
      success: true,
      rootWallpaperUrl,
      rootWallpaperPath: rootRelative,
      wallpapers: publicWallpapers,
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-wallpapers-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: {
    maxBodySize: 15 * 1024 * 1024, // 15MB for wallpaper video/image upload
  },
  handler: async (req) => {
    ensureWorkspaceExists();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const target = (formData.get('target') as string) || 'root';
    const subDir = (formData.get('subDir') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'NO_FILE_UPLOADED' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let targetSubDir = '';
    if (target === 'column' && subDir) {
      targetSubDir = subDir;
    }

    const saved = saveVaultWallpaperFile(buffer, file.name, targetSubDir);

    return NextResponse.json({
      success: true,
      wallpaperPath: saved.relativePath,
      wallpaperUrl: saved.url,
      message: 'WALLPAPER SAVED TO WORKSPACE VAULT',
    });
  },
});

export const DELETE = createSecureRoute({
  id: 'api-wallpapers-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req) => {
    ensureWorkspaceExists();
    const target = req.nextUrl.searchParams.get('target') || 'root';
    const subDir = req.nextUrl.searchParams.get('subDir') || '';

    let subDirRelative = '';
    if (target === 'column' && subDir) {
      subDirRelative = subDir;
    }

    deleteVaultWallpaperFile(subDirRelative);

    return NextResponse.json({
      success: true,
      message: 'WALLPAPER REMOVED FROM WORKSPACE VAULT',
    });
  },
});

import { NextRequest, NextResponse } from 'next/server';
import {
  loadCategoriesFromFS,
  saveCategoriesToFS,
  loadCategoriesFromFSAsync,
  saveCategoriesToFSAsync,
  deleteCategoryAndDocumentsFromFS,
  deleteCategoryAndDocumentsFromFSAsync,
} from '@/lib/workspaceFS';
import { DocCategory } from '@/lib/types';
import { findBestSemanticWallpaper } from '@/lib/wallpaper-nlp';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import fs from 'fs';
import path from 'path';

function getAvailableWallpapers(): string[] {
  try {
    const dirPath = path.join(process.cwd(), 'public', 'wallpapers');
    if (fs.existsSync(dirPath)) {
      return fs
        .readdirSync(dirPath)
        .filter((f) => /\.(webm|mp4|gif|png|jpe?g|webp|svg)$/i.test(f));
    }
  } catch {
    // Ignore error
  }
  return [];
}

export async function GET(req: NextRequest) {
  await resolveRequestContextVault(req);
  const categories = await loadCategoriesFromFSAsync();
  return NextResponse.json({
    success: true,
    total: categories.length,
    categories,
    storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
  });
}

export async function POST(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = await req.json();
    const currentCategories = await loadCategoriesFromFSAsync();
    const availableWp = getAvailableWallpapers();

    let wallpaper = payload.wallpaper;
    const isManual = Boolean(payload.isWallpaperManual);

    if (!isManual) {
      const match = findBestSemanticWallpaper(payload.title || 'Stack', availableWp);
      wallpaper = match.filename;
    }

    const newCat: DocCategory = {
      id: payload.id || `cat-${Date.now()}`,
      boardId: payload.boardId,
      title: payload.title || 'NEW_STACK',
      glyph: payload.glyph || 'Folder',
      color: payload.color || '#D4AF37',
      description: payload.description || 'Workspace stack category',
      wallpaper,
      isWallpaperManual: isManual,
    };

    const updated = [...currentCategories, newCat];
    await saveCategoriesToFSAsync(updated);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'POST',
      endpoint: '/api/categories',
      action: 'CATEGORY_CREATED',
      details: `Created stack "${newCat.title}"`,
      payload: newCat,
    });

    return NextResponse.json(
      { success: true, category: newCat, message: 'CATEGORY SAVED TO DISK' },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = await req.json();
    if (!payload.id) {
      return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });
    }

    const currentCategories = await loadCategoriesFromFSAsync();
    const existing = currentCategories.find((c) => c.id === payload.id);
    const availableWp = getAvailableWallpapers();

    let isManual = payload.isWallpaperManual !== undefined
      ? Boolean(payload.isWallpaperManual)
      : existing?.isWallpaperManual ?? false;

    let wallpaper = payload.wallpaper;

    // If not manual override, evaluate new title with wink-nlp
    if (!isManual && payload.title) {
      const match = findBestSemanticWallpaper(payload.title, availableWp);
      wallpaper = match.filename;
    } else if (isManual && wallpaper === undefined && existing) {
      wallpaper = existing.wallpaper;
    }

    const updated = currentCategories.map((c) =>
      c.id === payload.id ? { ...c, ...payload, wallpaper, isWallpaperManual: isManual } : c
    );

    await saveCategoriesToFSAsync(updated);

    const target = updated.find((c) => c.id === payload.id);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'PUT',
      endpoint: '/api/categories',
      action: 'CATEGORY_UPDATED',
      details: `Updated stack "${target?.title || payload.id}"`,
      payload: target,
    });

    return NextResponse.json({ success: true, category: target });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    let id = req.nextUrl.searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });
    }

    const result = await deleteCategoryAndDocumentsFromFSAsync(id);

    publishRealtimeEvent({
      workspaceId: wsId,
      source: 'api',
      method: 'DELETE',
      endpoint: '/api/categories',
      action: 'CATEGORY_DELETED',
      details: `Deleted stack ID ${id}`,
      payload: { id, ...result },
    });

    return NextResponse.json({ success: true, purgedId: id, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'DELETE_FAILED' }, { status: 500 });
  }
}

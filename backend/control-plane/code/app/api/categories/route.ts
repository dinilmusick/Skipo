import { NextResponse } from 'next/server';
import {
  loadCategoriesFromFSAsync,
  saveCategoriesToFSAsync,
  deleteCategoryAndDocumentsFromFSAsync,
} from '@/lib/workspaceFS';
import { DocCategory } from '@/lib/types';
import { findBestSemanticWallpaper } from '@/lib/wallpaper-nlp';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { createSecureRoute } from '@/lib/api-governance';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export const GET = createSecureRoute({
  id: 'api-categories-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    await resolveRequestContextVault(req);
    const categories = await loadCategoriesFromFSAsync();
    return NextResponse.json({
      success: true,
      total: categories.length,
      categories,
      storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-categories-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 512 * 1024 },
  handler: async (req, { body }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = body || {};
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
  },
});

export const PUT = createSecureRoute({
  id: 'api-categories-put',
  method: 'PUT',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 512 * 1024 },
  handler: async (req, { body }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const payload = body || {};
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
  },
});

export const DELETE = createSecureRoute({
  id: 'api-categories-delete',
  method: 'DELETE',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { body, query }) => {
    await resolveRequestContextVault(req);
    const wsId = req.headers.get('x-workspace-id') || undefined;
    const id = query.get('id') || body?.id;

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
  },
});

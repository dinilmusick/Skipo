/**
 * POST /api/auth/storage/sync-clones
 *
 * Replicates active workspace files, categories, graph topology, manifests,
 * and markdown documents from the Primary Storage to designated Redundant Clone
 * cloud storage options (Backblaze B2, Cloudflare R2, AWS S3, Supabase).
 */

import { NextResponse } from 'next/server';
import { findUserByIdAsync, updateUserProfileAsync, resolveRequestContextVault } from '@/lib/auth-storage';
import { loadDocumentsFromFSAsync, loadCategoriesFromFSAsync, loadGraphFromFSAsync, formatCanonicalWorkspaceFolderName } from '@/lib/workspaceFS';
import { syncEntireWorkspaceToCloud } from '@/lib/cloud-storage-service';
import { UserStorageConnection } from '@/lib/types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-storage-sync-clones-post',
  method: 'POST',
  auth: true,
  rateLimit: { tier: 'EXPENSIVE_OPERATION' },
  limits: { maxBodySize: 64 * 1024, executionTimeoutMs: 60000, maxConcurrency: 2 },
  handler: async (req, { session, body }) => {
    const user = await findUserByIdAsync(session!.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const targetCloneIds: string[] | undefined = body?.cloneIds;

    // Resolve active workspace and primary storage context
    const vaultContext = await resolveRequestContextVault(req);

    // Fetch complete workspace data
    const [documents, categories, graph] = await Promise.all([
      loadDocumentsFromFSAsync(),
      loadCategoriesFromFSAsync(),
      loadGraphFromFSAsync(),
    ]);

    const allConnections: UserStorageConnection[] =
      user.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];

    // Find clone connections (exclude primary and exclude local_fs which syncs via browser handle)
    const cloneConnections = allConnections.filter((conn) => {
      if (conn.role === 'primary') return false;
      if (conn.provider === 'local_fs') return false;
      if (targetCloneIds && targetCloneIds.length > 0) {
        return targetCloneIds.includes(conn.id);
      }
      return true;
    });

    if (cloneConnections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cloud clone storage connections found to sync.',
        syncedClones: [],
        totalFilesSynced: 0,
      });
    }

    const folderPrefix = vaultContext.folderPrefix || formatCanonicalWorkspaceFolderName('DocuStack', vaultContext.user?.name || vaultContext.user?.username || 'user', 'workspace');
    const results: Array<{ id: string; label: string; provider: string; filesSynced: number }> = [];
    let totalFiles = 0;

    for (const clone of cloneConnections) {
      try {
        const syncResult = await syncEntireWorkspaceToCloud(clone, folderPrefix, {
          nodes: graph.nodes,
          edges: graph.edges,
          groups: graph.groups,
          categories,
          documents,
        });

        results.push({
          id: clone.id,
          label: clone.label,
          provider: clone.provider,
          filesSynced: syncResult.syncedCount,
        });
        totalFiles += syncResult.syncedCount;
      } catch (cloneErr: any) {
        console.warn(`[SyncClones] Failed to sync to clone ${clone.label}:`, cloneErr);
        results.push({
          id: clone.id,
          label: clone.label,
          provider: clone.provider,
          filesSynced: 0,
        });
      }
    }

    // Persist updated lastTestedAt on synced connections safely
    const nowIso = new Date().toISOString();
    const freshUser = await findUserByIdAsync(session!.userId);
    const targetUser = freshUser || user;
    const currentConnections: UserStorageConnection[] =
      targetUser.appProfiles?.docustack?.storage_connections || (targetUser as any)?.storage_connections || allConnections;

    const mergedConnections = currentConnections.map((conn) => {
      const wasSynced = results.some((r) => r.id === conn.id && r.filesSynced > 0);
      return wasSynced ? { ...conn, lastTestedAt: nowIso } : conn;
    });

    const updatedAppProfiles = {
      ...(targetUser.appProfiles || {}),
      docustack: {
        ...(targetUser.appProfiles?.docustack || {}),
        storage_connections: mergedConnections,
      },
    };

    await updateUserProfileAsync(session!.userId, {
      appProfiles: updatedAppProfiles,
      storage_connections: mergedConnections,
    } as any);


    return NextResponse.json({
      success: true,
      syncedClones: results,
      totalFilesSynced: totalFiles,
      message: `Successfully replicated ${totalFiles} files across ${results.length} clone storage options.`,
    });
  },
});


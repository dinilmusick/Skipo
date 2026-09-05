import { NextRequest, NextResponse } from 'next/server';
import {
  loadGraphFromFSAsync,
  loadCategoriesFromFSAsync,
  loadDocumentsFromFSAsync,
  getVaultAbsolutePath,
  getActiveVaultName,
} from '@/lib/workspaceFS';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { debugManager } from '@/lib/debug-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/sync-audit
 * Audits 100% synchronization across 3 tiers:
 *  1. Frontend In-Memory React State (if reported by browser)
 *  2. Browser LocalStorage (if reported by browser)
 *  3. Backend Persistent Vault Storage (stored on physical disk / cloud)
 *
 * Delegates internally to DebugManager consistency engine while preserving backward compatibility.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await resolveRequestContextVault(req);
    const serverGraph = await loadGraphFromFSAsync();
    const serverCategories = await loadCategoriesFromFSAsync();
    const serverDocs = await loadDocumentsFromFSAsync();
    const vaultPath = getVaultAbsolutePath();
    const vaultName = getActiveVaultName();

    const serverUser = session?.user || null;
    const wsId = serverUser?.activeWorkspaceId || 'default';

    const cached = global.__docustack_latest_ui_state;
    const clientConnected = Boolean(cached && Date.now() - cached.clientMeta!.receivedAt < 300000);
    const clientState = cached?.state;

    // Run deep check in debug manager
    const consistency = await debugManager.runConsistencyCheck(wsId);

    const diffs: string[] = [];

    // Tier 1 vs Tier 3: Client React State vs Server Physical Storage
    const uiNodeCount = clientState?.nodeGraph?.nodes?.length ?? (serverGraph.nodes || []).length;
    const serverNodeCount = (serverGraph.nodes || []).length;
    const graphNodeDiff = Math.abs(uiNodeCount - serverNodeCount);

    const uiEdgeCount = clientState?.nodeGraph?.edges?.length ?? (serverGraph.edges || []).length;
    const serverEdgeCount = (serverGraph.edges || []).length;
    const graphEdgeDiff = Math.abs(uiEdgeCount - serverEdgeCount);

    const uiDocCount = clientState?.vaultBrowser?.documents?.length ?? serverDocs.length;
    const serverDocCount = serverDocs.length;
    const docDiff = Math.abs(uiDocCount - serverDocCount);

    const uiCatCount = clientState?.vaultBrowser?.categories?.length ?? serverCategories.length;
    const serverCatCount = serverCategories.length;
    const catDiff = Math.abs(uiCatCount - serverCatCount);

    if (clientConnected) {
      if (graphNodeDiff > 0) {
        diffs.push(`Node count divergence: Client UI (${uiNodeCount}) vs Server Disk (${serverNodeCount})`);
      }
      if (graphEdgeDiff > 0) {
        diffs.push(`Edge count divergence: Client UI (${uiEdgeCount}) vs Server Disk (${serverEdgeCount})`);
      }
      if (docDiff > 0) {
        diffs.push(`Document count divergence: Client UI (${uiDocCount}) vs Server Disk (${serverDocCount})`);
      }
      if (catDiff > 0) {
        diffs.push(`Category count divergence: Client UI (${uiCatCount}) vs Server Disk (${serverCatCount})`);
      }

      // Check LocalStorage vs React state
      if (clientState?.syncAudit?.diffSummary && clientState.syncAudit.diffSummary.length > 0) {
        diffs.push(...clientState.syncAudit.diffSummary);
      }
    }

    const totalAuditedChecks = 6;
    const failedChecks = diffs.length;
    const passedChecks = Math.max(0, totalAuditedChecks - failedChecks);
    const syncScore = Math.round((passedChecks / totalAuditedChecks) * 100);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      clientConnected,
      isFullySynced: diffs.length === 0 && consistency.consistent,
      syncScorePercent: syncScore,
      vault: {
        name: vaultName,
        path: vaultPath,
      },
      auditDetails: {
        nodeGraph: {
          inSync: graphNodeDiff === 0 && graphEdgeDiff === 0,
          uiNodeCount,
          serverNodeCount,
          uiEdgeCount,
          serverEdgeCount,
        },
        documents: {
          inSync: docDiff === 0,
          uiDocCount,
          serverDocCount,
        },
        categories: {
          inSync: catDiff === 0,
          uiCatCount,
          serverCatCount,
        },
        activeWorkspace: {
          inSync: Boolean(
            !clientConnected ||
              !clientState?.menus?.activeWorkspace?.id ||
              clientState.menus.activeWorkspace.id === serverUser?.activeWorkspaceId
          ),
          uiWorkspaceId: clientState?.menus?.activeWorkspace?.id || serverUser?.activeWorkspaceId,
          serverWorkspaceId: serverUser?.activeWorkspaceId || null,
        },
        localStorageSync: clientState?.syncAudit || {
          isSynced: true,
          syncScorePercent: 100,
          checks: [],
        },
        engineConsistency: {
          consistent: consistency.consistent,
          discrepanciesCount: consistency.discrepancies.length,
          revisions: consistency.revisions,
        },
      },
      divergences: diffs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'SYNC_AUDIT_FAILED', message: err?.message },
      { status: 500 }
    );
  }
}

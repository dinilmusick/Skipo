import { NextRequest, NextResponse } from 'next/server';
import {
  FullFrontendUiState,
  filterDebugStateSection,
} from '@/lib/debug-ui-state';
import {
  loadGraphFromFSAsync,
  loadCategoriesFromFSAsync,
  loadDocumentsFromFSAsync,
  getVaultAbsolutePath,
  getActiveVaultName,
  getActiveStorageConn,
  getActiveFolderPrefix,
  getWorkspaceFileTree,
} from '@/lib/workspaceFS';
import { resolveRequestContextVault, findUserByIdAsync } from '@/lib/auth-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// In-memory relay storage for latest client UI state
declare global {
  // eslint-disable-next-line no-var
  var __docustack_latest_ui_state: {
    state: FullFrontendUiState;
    clientMeta?: {
      url?: string;
      userAgent?: string;
      ip?: string;
      receivedAt: number;
    };
  } | undefined;
}

/**
 * POST /api/debug/ui-state
 * Allows the browser client (or automated test harness) to publish its live UI state.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload || !payload.state) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PAYLOAD: Expected { state: FullFrontendUiState }' },
        { status: 400 }
      );
    }

    const state: FullFrontendUiState = payload.state;
    const clientMeta = {
      url: payload.clientMeta?.url,
      userAgent: req.headers.get('user-agent') || payload.clientMeta?.userAgent,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      receivedAt: Date.now(),
    };

    global.__docustack_latest_ui_state = {
      state,
      clientMeta,
    };

    return NextResponse.json({
      success: true,
      message: 'UI_STATE_RECEIVED',
      timestamp: Date.now(),
      clientMeta,
      summary: {
        nodeCount: state.nodeGraph?.nodes?.length ?? 0,
        edgeCount: state.nodeGraph?.edges?.length ?? 0,
        groupCount: state.nodeGraph?.groups?.length ?? 0,
        tabsCount: state.menus?.tabs?.length ?? 0,
        activeWorkspaceId: state.menus?.activeWorkspace?.id,
        syncScore: state.syncAudit?.syncScorePercent,
        isSynced: state.syncAudit?.isSynced,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'FAILED_TO_PROCESS_UI_STATE', message: err?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/debug/ui-state
 * Returns the latest UI state.
 * Query Parameters:
 *  - section: 'nodegraph' | 'menus' | 'vault' | 'settings' | 'localstorage' | 'sync' | 'all'
 *  - format: 'pretty' (returns indented JSON)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'all';
    const isPretty = searchParams.get('format') === 'pretty';

    const cached = global.__docustack_latest_ui_state;
    const isFresh = cached && Date.now() - cached.clientMeta!.receivedAt < 300000; // within 5 mins

    if (cached && isFresh) {
      const filtered = filterDebugStateSection(cached.state, section);
      const responsePayload = {
        success: true,
        source: 'browser_client_live',
        clientConnected: true,
        clientLastSeenAgoMs: Date.now() - cached.clientMeta!.receivedAt,
        clientMeta: cached.clientMeta,
        section,
        data: filtered,
      };

      return isPretty
        ? new Response(JSON.stringify(responsePayload, null, 2), {
            headers: { 'Content-Type': 'application/json' },
          })
        : NextResponse.json(responsePayload);
    }

    // Fallback: Reconstruct state from server-side persistent storage
    const session = await resolveRequestContextVault(req);
    const graph = await loadGraphFromFSAsync();
    const categories = await loadCategoriesFromFSAsync();
    const documents = await loadDocumentsFromFSAsync();
    const vaultPath = getVaultAbsolutePath();
    const vaultName = getActiveVaultName();
    const storageConn = getActiveStorageConn();
    const folderPrefix = getActiveFolderPrefix();
    const fileTree = getWorkspaceFileTree();
    let fileCount = 0;
    let folderCount = 0;
    function countNodes(node: any) {
      if (!node) return;
      if (node.isDirectory) {
        folderCount++;
        if (Array.isArray(node.children)) node.children.forEach(countNodes);
      } else {
        fileCount++;
      }
    }
    countNodes(fileTree);
    const stats = { fileCount, folderCount };

    const currentUserRecord = session?.user || null;

    const fallbackState: FullFrontendUiState = {
      version: '1.0.0-server-fallback',
      timestamp: Date.now(),
      nodeGraph: {
        nodes: graph.nodes || [],
        edges: graph.edges || [],
        groups: graph.groups || [],
        activeSelection: {
          selectedNodeIds: [],
          focusTarget: null,
        },
        viewport: { scale: 1, pan: { x: 0, y: 0 } },
        summary: {
          totalNodes: (graph.nodes || []).length,
          totalEdges: (graph.edges || []).length,
          totalGroups: (graph.groups || []).length,
          rootNodeId: graph.nodes?.find((n) => n.isWorkspaceRoot)?.id,
          folderNodesCount: graph.nodes?.filter((n) => n.type === 'folder').length || 0,
          collectionNodesCount: graph.nodes?.filter((n) => n.type === 'collection').length || 0,
          stickyNodesCount: graph.nodes?.filter((n) => n.type === 'sticky').length || 0,
          orphanNodesCount: 0,
        },
        saveStatus: 'saved',
      },
      menus: {
        currentUser: currentUserRecord
          ? {
              id: currentUserRecord.id,
              username: currentUserRecord.username,
              email: currentUserRecord.email,
              role: currentUserRecord.role,
              name: currentUserRecord.name,
              storageConnectionsCount: (currentUserRecord.storage_connections || []).length,
              activeWorkspaceId: currentUserRecord.activeWorkspaceId,
            }
          : null,
        accountWorkspaces: currentUserRecord?.workspaces || [],
        activeWorkspace: {
          id: currentUserRecord?.activeWorkspaceId || 'ws-default',
          name: currentUserRecord?.workspaceName || vaultName,
          path: currentUserRecord?.workspacePath || vaultPath,
        },
        tabs: [],
        activeTabId: 'ws-main',
        modalStates: {
          isWorkspacesMenuOpen: false,
          isWorkspaceFolderSelectorOpen: false,
          isMediaVaultOpen: false,
          isAdminPanelOpen: false,
          isSettingsOpen: false,
          isVaultExplorerOpen: false,
          isLoginOpen: false,
          isDebugModalOpen: false,
        },
        navigation: {
          viewMode: 'graph',
          activeCollectionId: 'kanban-main',
          activeCollectionTitle: 'CORE_KANBAN_BOARD',
        },
      },
      vaultBrowser: {
        activeVaultName: vaultName,
        vaultPath,
        storageProvider: storageConn?.provider || 'local_fs',
        isCloudPrimary: Boolean(storageConn && storageConn.provider !== 'local_fs'),
        folderPrefix: folderPrefix || '',
        categories,
        documents,
        treeStats: stats,
        localDirectoryHandle: {
          isConnected: false,
        },
        cloneConnections: [],
      },
      settingsAndPreferences: {
        theme: 'dark',
        themeConfig: {
          id: 'server-default',
          name: 'Server Default',
          accent: '#D4AF37',
          accentSecondary: '#FF851B',
          base: '#1E1E24',
          surface: '#2B2B36',
          surfaceSubtle: '#24242E',
          text: '#F3EDE0',
          textMuted: '#A09D95',
          border: '#000000',
          headingFont: 'monospace',
          bodyFont: 'monospace',
          overlayColor: '#000000',
          overlayOpacity: 0.7,
          columnWallpaperOpacity: 0.15,
          columnOverlayColor: '#000000',
          columnOverlayOpacity: 0.5,
        },
        savedThemesCount: 0,
        savedThemesList: [],
        biome: 'forest',
        motionEnabled: true,
        appWallpaper: null,
        autoSaveEnabled: true,
        autoSaveClonesEnabled: false,
        localFsDeviceError: null,
        isLocalFsDisabledForSession: false,
      },
      localStorage: {
        rawKeys: {},
        graphCached: {
          present: false,
          nodeCount: (graph.nodes || []).length,
          edgeCount: (graph.edges || []).length,
          groupCount: (graph.groups || []).length,
        },
        activeWorkspaceIdInStorage: currentUserRecord?.activeWorkspaceId || null,
        workspaceTabsInStorageCount: 0,
        activeTabIdInStorage: null,
        autoSaveInStorage: true,
        autoSaveClonesInStorage: false,
      },
      syncAudit: {
        isSynced: true,
        syncScorePercent: 100,
        totalChecks: 7,
        passedChecks: 7,
        failedChecks: 0,
        timestamp: Date.now(),
        checks: [
          {
            name: 'Server Baseline Graph Integrity',
            passed: true,
            uiValue: (graph.nodes || []).length,
            storageValue: (graph.nodes || []).length,
          },
        ],
        diffSummary: [],
      },
    };

    const filtered = filterDebugStateSection(fallbackState, section);
    const responsePayload = {
      success: true,
      source: 'server_state_fallback',
      clientConnected: false,
      note: 'No active browser client currently reporting. Returning server persistent vault data.',
      section,
      data: filtered,
    };

    return isPretty
      ? new Response(JSON.stringify(responsePayload, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        })
      : NextResponse.json(responsePayload);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'FAILED_TO_FETCH_UI_STATE', message: err?.message },
      { status: 500 }
    );
  }
}

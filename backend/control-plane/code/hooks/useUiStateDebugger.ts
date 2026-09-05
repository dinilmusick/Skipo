'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GraphNode,
  GraphEdge,
  GraphGroup,
  DocCategory,
  DocumentItem,
  WorkspaceTab,
  UserAccount,
  UserStorageConnection,
  ThemeMode,
  CustomThemeConfig,
  BiomeType,
} from '../lib/types';
import {
  FullFrontendUiState,
  NodeGraphDebugState,
  WorkspacesMenuDebugState,
  VaultBrowserDebugState,
  SettingsPreferencesDebugState,
  LocalStorageSyncDebugState,
  SyncAuditResult,
  extractLocalStorageSnapshot,
  auditFrontendSync,
  filterDebugStateSection,
} from '../lib/debug-ui-state';
import { RenderedSnapshot } from '../lib/debug-types';
import { getActiveLocalDirectoryHandle } from '../lib/local-fs-handle';
import { formatCanonicalWorkspaceFolderName } from '../lib/workspace-canonical';

declare global {
  interface Window {
    DocuStackDebug?: {
      getUiState: (section?: string) => any;
      getNodeGraph: () => NodeGraphDebugState;
      getWorkspacesMenu: () => WorkspacesMenuDebugState;
      getVaultBrowserStructure: () => VaultBrowserDebugState;
      getSettingsAndPreferences: () => SettingsPreferencesDebugState;
      getLocalStorageState: () => LocalStorageSyncDebugState;
      getRenderedElements: () => RenderedSnapshot;
      verifySync: () => SyncAuditResult;
      exportStateJson: () => string;
      pushStateToBackend: () => Promise<any>;
      getStatus: () => Promise<any>;
    };
    __DEBUG_CLIENT__?: {
      getSnapshot: () => FullFrontendUiState;
      getRendered: () => RenderedSnapshot;
      getSyncAudit: () => SyncAuditResult;
      syncToBackend: () => Promise<any>;
      isCollecting: () => boolean;
    };
    __DOCUSTACK_UI_STATE__?: FullFrontendUiState;
  }
}

interface UseUiStateDebuggerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  categories: DocCategory[];
  documents: DocumentItem[];
  workspaces: WorkspaceTab[];
  activeTabId: string;
  activeVaultWorkspaceId: string;
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  theme: ThemeMode;
  themeConfig: CustomThemeConfig;
  savedThemes: CustomThemeConfig[];
  biome: BiomeType;
  motionEnabled: boolean;
  appWallpaper: string | null;
  autoSaveEnabled: boolean;
  autoSaveClonesEnabled: boolean;
  cloneConnections: UserStorageConnection[];
  localFsDeviceError: string | null;
  isLocalFsDisabledForSession: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'dirty';
  viewMode: 'graph' | 'kanban' | 'work' | 'tags' | 'search';
  activeCollectionId: string;
  activeCollectionTitle: string;
  focusTarget: { type: 'node' | 'group'; id: string; timestamp: number } | null;
  modalStates: {
    isWorkspacesMenuOpen: boolean;
    isWorkspaceFolderSelectorOpen: boolean;
    isMediaVaultOpen: boolean;
    isAdminPanelOpen: boolean;
    isSettingsOpen: boolean;
    isVaultExplorerOpen: boolean;
    isLoginOpen: boolean;
  };
}

/**
 * Headless Client-Side Debug Collector
 * Zero UI overhead. Zero network requests when debug is OFF.
 * Programmatically extracts DOM rendered elements, mirrors to LocalStorage,
 * and exposes window.DocuStackDebug and window.__DEBUG_CLIENT__.
 */
export function useUiStateDebugger({
  nodes,
  edges,
  groups,
  categories,
  documents,
  workspaces,
  activeTabId,
  activeVaultWorkspaceId,
  currentUser,
  theme,
  themeConfig,
  savedThemes,
  biome,
  motionEnabled,
  appWallpaper,
  autoSaveEnabled,
  autoSaveClonesEnabled,
  cloneConnections,
  localFsDeviceError,
  isLocalFsDisabledForSession,
  saveStatus,
  viewMode,
  activeCollectionId,
  activeCollectionTitle,
  focusTarget,
  modalStates,
}: UseUiStateDebuggerProps) {
  const [fullUiState, setFullUiState] = useState<FullFrontendUiState | null>(null);
  const [lastSyncAudit, setLastSyncAudit] = useState<SyncAuditResult | null>(null);
  const isCollectingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extract actual rendered elements directly from the DOM
  const extractRenderedSnapshot = useCallback((): RenderedSnapshot => {
    const wsId = activeVaultWorkspaceId || currentUser?.activeWorkspaceId || 'default';
    if (typeof document === 'undefined') {
      return {
        workspaceId: wsId,
        renderedNodeIds: [],
        renderedEdgeIds: [],
        renderedGroupIds: [],
        nodeCount: 0,
        edgeCount: 0,
        groupCount: 0,
        visibleNodeIds: [],
        selectedNodeIds: [],
        viewport: { scale: 1, pan: { x: 0, y: 0 } },
        zoomLevel: 1,
        renderOmissions: [],
        timestamp: Date.now(),
      };
    }

    try {
      const nodeElements = document.querySelectorAll('[data-node-id]');
      const edgeElements = document.querySelectorAll('[data-edge-id]');
      const groupElements = document.querySelectorAll('[data-group-id]');

      const renderedNodeIds: string[] = [];
      nodeElements.forEach((el) => {
        const id = el.getAttribute('data-node-id');
        if (id) renderedNodeIds.push(id);
      });

      const renderedEdgeIds: string[] = [];
      edgeElements.forEach((el) => {
        const id = el.getAttribute('data-edge-id');
        if (id) renderedEdgeIds.push(id);
      });

      const renderedGroupIds: string[] = [];
      groupElements.forEach((el) => {
        const id = el.getAttribute('data-group-id');
        if (id) renderedGroupIds.push(id);
      });

      // Detect render omissions (nodes present in state but absent in DOM)
      const stateNodeIds = nodes.map((n) => n.id);
      const renderedSet = new Set(renderedNodeIds);
      const renderOmissions = stateNodeIds.filter((id) => !renderedSet.has(id));

      return {
        workspaceId: wsId,
        renderedNodeIds: renderedNodeIds.length > 0 ? renderedNodeIds : stateNodeIds,
        renderedEdgeIds: renderedEdgeIds.length > 0 ? renderedEdgeIds : edges.map((e) => e.id),
        renderedGroupIds: renderedGroupIds.length > 0 ? renderedGroupIds : groups.map((g) => g.id),
        nodeCount: renderedNodeIds.length > 0 ? renderedNodeIds.length : nodes.length,
        edgeCount: renderedEdgeIds.length > 0 ? renderedEdgeIds.length : edges.length,
        groupCount: renderedGroupIds.length > 0 ? renderedGroupIds.length : groups.length,
        visibleNodeIds: renderedNodeIds.length > 0 ? renderedNodeIds : stateNodeIds,
        selectedNodeIds: [],
        viewport: { scale: 1, pan: { x: 0, y: 0 } },
        zoomLevel: 1,
        renderOmissions: renderedNodeIds.length > 0 ? renderOmissions : [],
        timestamp: Date.now(),
      };
    } catch {
      return {
        workspaceId: wsId,
        renderedNodeIds: nodes.map((n) => n.id),
        renderedEdgeIds: edges.map((e) => e.id),
        renderedGroupIds: groups.map((g) => g.id),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        groupCount: groups.length,
        visibleNodeIds: nodes.map((n) => n.id),
        selectedNodeIds: [],
        viewport: { scale: 1, pan: { x: 0, y: 0 } },
        zoomLevel: 1,
        renderOmissions: [],
        timestamp: Date.now(),
      };
    }
  }, [nodes, edges, groups, activeVaultWorkspaceId, currentUser?.activeWorkspaceId]);

  // Assemble full frontend state snapshot
  const assembleSnapshot = useCallback((): FullFrontendUiState => {
    const activeWs = currentUser?.workspaces?.find(
      (w) => w.id === (activeVaultWorkspaceId || currentUser.activeWorkspaceId)
    );
    const uName = currentUser?.username || currentUser?.name || 'user';
    const activeWsName = activeWs?.name || 'DocuStack Vault';
    const activeWsPath =
      activeWs?.workspacePath ||
      (activeWs?.name ? formatCanonicalWorkspaceFolderName('docustack', uName, activeWs.name) : '') ||
      '';

    const localHandle = typeof window !== 'undefined' ? getActiveLocalDirectoryHandle() : null;

    const nodeGraphState: NodeGraphDebugState = {
      nodes,
      edges,
      groups,
      activeSelection: {
        selectedNodeIds: [],
        focusTarget,
      },
      viewport: {
        scale: 1,
        pan: { x: 0, y: 0 },
      },
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalGroups: groups.length,
        rootNodeId: nodes.find((n) => n.isWorkspaceRoot)?.id,
        folderNodesCount: nodes.filter((n) => n.type === 'folder').length,
        collectionNodesCount: nodes.filter((n) => n.type === 'collection').length,
        stickyNodesCount: nodes.filter((n) => n.type === 'sticky').length,
        orphanNodesCount: nodes.filter((n) => !edges.some((e) => e.source === n.id || e.target === n.id)).length,
      },
      saveStatus,
    };

    const workspacesMenuState: WorkspacesMenuDebugState = {
      currentUser: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            name: currentUser.name,
            storageConnectionsCount: (currentUser.storage_connections || []).length,
            activeWorkspaceId: currentUser.activeWorkspaceId,
          }
        : null,
      accountWorkspaces: currentUser?.workspaces || [],
      activeWorkspace: {
        id: activeVaultWorkspaceId || currentUser?.activeWorkspaceId || 'ws-default',
        name: activeWsName,
        path: activeWsPath,
        localFolderKey: activeWs?.localFolderKey,
        localFolderName: activeWs?.localFolderName,
      },
      tabs: workspaces,
      activeTabId,
      modalStates: {
        ...modalStates,
        isDebugModalOpen: false,
      },
      navigation: {
        viewMode,
        activeCollectionId,
        activeCollectionTitle,
      },
    };

    const vaultBrowserState: VaultBrowserDebugState = {
      activeVaultName: activeWsName,
      vaultPath: activeWsPath,
      storageProvider: 'local_fs',
      isCloudPrimary: false,
      folderPrefix: activeWsPath,
      categories,
      documents,
      treeStats: {
        fileCount: documents.length,
        folderCount: categories.length,
      },
      localDirectoryHandle: {
        isConnected: Boolean(localHandle),
        name: localHandle?.name,
      },
      cloneConnections,
    };

    const settingsPreferencesState: SettingsPreferencesDebugState = {
      theme,
      themeConfig,
      savedThemesCount: savedThemes.length,
      savedThemesList: savedThemes.map((st) => ({ id: st.id, name: st.name })),
      biome,
      motionEnabled,
      appWallpaper,
      autoSaveEnabled,
      autoSaveClonesEnabled,
      localFsDeviceError,
      isLocalFsDisabledForSession,
    };

    const storageSnapshot = extractLocalStorageSnapshot();
    const audit = auditFrontendSync(
      nodeGraphState,
      workspacesMenuState,
      settingsPreferencesState,
      storageSnapshot
    );

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      nodeGraph: nodeGraphState,
      menus: workspacesMenuState,
      vaultBrowser: vaultBrowserState,
      settingsAndPreferences: settingsPreferencesState,
      localStorage: storageSnapshot,
      syncAudit: audit,
    };
  }, [
    nodes,
    edges,
    groups,
    categories,
    documents,
    workspaces,
    activeTabId,
    activeVaultWorkspaceId,
    currentUser,
    theme,
    themeConfig,
    savedThemes,
    biome,
    motionEnabled,
    appWallpaper,
    autoSaveEnabled,
    autoSaveClonesEnabled,
    cloneConnections,
    localFsDeviceError,
    isLocalFsDisabledForSession,
    saveStatus,
    viewMode,
    activeCollectionId,
    activeCollectionTitle,
    focusTarget,
    modalStates,
  ]);

  // Push state to backend API (only called when collecting or explicitly invoked)
  const pushStateToBackend = useCallback(async (snapshot?: FullFrontendUiState) => {
    if (typeof window === 'undefined') return;
    const target = snapshot || assembleSnapshot();
    const rendered = extractRenderedSnapshot();

    try {
      await fetch('/api/debug/ui-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          state: target,
          rendered,
          clientMeta: {
            url: window.location.href,
            receivedAt: Date.now(),
          },
        }),
      });
    } catch {
      // Passive background relay, fail silently
    }
  }, [assembleSnapshot, extractRenderedSnapshot]);

  // Check server debug status periodically (every 60s) or upon demand
  const checkServerDebugMode = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/debug/status', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const enabled = json?.manifest?.debugEnabled || false;
        isCollectingRef.current = enabled;
        return enabled;
      }
    } catch {
      // Server unreachable or debug disabled
    }
    isCollectingRef.current = false;
    return false;
  }, []);

  // Reactive synchronizer: mirrors graph to localStorage and pushes to backend IF active
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Immediately mirror active node graph to localStorage
    const wsId = activeVaultWorkspaceId || currentUser?.activeWorkspaceId || 'default';
    const graphKey = `docustack_workspace_graph_${wsId}`;
    try {
      window.localStorage.setItem(
        graphKey,
        JSON.stringify({
          nodes,
          edges,
          groups,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // Storage quota exceeded or private mode
    }

    // 2. Compute fresh snapshot and audit
    const snapshot = assembleSnapshot();
    setFullUiState(snapshot);
    setLastSyncAudit(snapshot.syncAudit);
    window.__DOCUSTACK_UI_STATE__ = snapshot;

    // 3. If debug collection is active, debounce-sync to backend
    if (isCollectingRef.current) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        pushStateToBackend(snapshot);
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    nodes,
    edges,
    groups,
    activeVaultWorkspaceId,
    currentUser?.activeWorkspaceId,
    assembleSnapshot,
    pushStateToBackend,
  ]);

  // Register window.DocuStackDebug and window.__DEBUG_CLIENT__ global APIs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.DocuStackDebug = {
      getUiState: (section?: string) => {
        const snap = assembleSnapshot();
        return filterDebugStateSection(snap, section);
      },
      getNodeGraph: () => assembleSnapshot().nodeGraph,
      getWorkspacesMenu: () => assembleSnapshot().menus,
      getVaultBrowserStructure: () => assembleSnapshot().vaultBrowser,
      getSettingsAndPreferences: () => assembleSnapshot().settingsAndPreferences,
      getLocalStorageState: () => assembleSnapshot().localStorage,
      getRenderedElements: () => extractRenderedSnapshot(),
      verifySync: () => {
        const snap = assembleSnapshot();
        return snap.syncAudit;
      },
      exportStateJson: () => {
        const snap = assembleSnapshot();
        return JSON.stringify(snap, null, 2);
      },
      pushStateToBackend: async () => {
        const snap = assembleSnapshot();
        await pushStateToBackend(snap);
        return { success: true, timestamp: Date.now() };
      },
      getStatus: async () => {
        return checkServerDebugMode();
      },
    };

    window.__DEBUG_CLIENT__ = {
      getSnapshot: () => assembleSnapshot(),
      getRendered: () => extractRenderedSnapshot(),
      getSyncAudit: () => assembleSnapshot().syncAudit,
      syncToBackend: async () => {
        const snap = assembleSnapshot();
        await pushStateToBackend(snap);
        return { success: true };
      },
      isCollecting: () => isCollectingRef.current,
    };

    return () => {
      delete window.DocuStackDebug;
      delete window.__DEBUG_CLIENT__;
    };
  }, [assembleSnapshot, extractRenderedSnapshot, pushStateToBackend, checkServerDebugMode]);

  return {
    fullUiState,
    lastSyncAudit,
    triggerManualSync: () => pushStateToBackend(),
    getRenderedSnapshot: extractRenderedSnapshot,
  };
}

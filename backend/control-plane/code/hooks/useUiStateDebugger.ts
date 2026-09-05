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
      verifySync: () => SyncAuditResult;
      exportStateJson: () => string;
      pushStateToBackend: () => Promise<any>;
      openDebugModal: () => void;
      closeDebugModal: () => void;
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
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [fullUiState, setFullUiState] = useState<FullFrontendUiState | null>(null);
  const [lastSyncAudit, setLastSyncAudit] = useState<SyncAuditResult | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        isDebugModalOpen,
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
    isDebugModalOpen,
  ]);

  // Push state to backend API
  const pushStateToBackend = useCallback(async (snapshot?: FullFrontendUiState) => {
    if (typeof window === 'undefined') return;
    const target = snapshot || assembleSnapshot();
    try {
      await fetch('/api/debug/ui-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          state: target,
          clientMeta: {
            url: window.location.href,
            receivedAt: Date.now(),
          },
        }),
      });
    } catch {
      // Passive background relay, fail silently
    }
  }, [assembleSnapshot]);

  // Reactive synchronizer: mirrors graph mutations to localStorage and debounce-pushes to backend
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

    // 3. Debounce-sync to backend REST endpoint
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushStateToBackend(snapshot);
    }, 400);

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

  // Register window.DocuStackDebug global API
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
      openDebugModal: () => setIsDebugModalOpen(true),
      closeDebugModal: () => setIsDebugModalOpen(false),
    };

    return () => {
      delete window.DocuStackDebug;
    };
  }, [assembleSnapshot, pushStateToBackend]);

  // Global hotkey: Cmd+Shift+D or Ctrl+Shift+D toggles Debug Inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDebugModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isDebugModalOpen,
    setIsDebugModalOpen,
    fullUiState,
    lastSyncAudit,
    triggerManualSync: () => pushStateToBackend(),
  };
}

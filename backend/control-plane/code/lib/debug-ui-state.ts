import {
  GraphNode,
  GraphEdge,
  GraphGroup,
  DocCategory,
  DocumentItem,
  WorkspaceTab,
  UserWorkspaceRecord,
  UserStorageConnection,
  ThemeMode,
  CustomThemeConfig,
  BiomeType,
} from './types';

export interface NodeGraphDebugState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  activeSelection: {
    selectedNodeIds: string[];
    focusTarget: { type: 'node' | 'group'; id: string; timestamp: number } | null;
  };
  viewport: {
    scale: number;
    pan: { x: number; y: number };
  };
  summary: {
    totalNodes: number;
    totalEdges: number;
    totalGroups: number;
    rootNodeId?: string;
    folderNodesCount: number;
    collectionNodesCount: number;
    stickyNodesCount: number;
    orphanNodesCount: number;
  };
  saveStatus: 'idle' | 'saving' | 'saved' | 'dirty';
}

export interface WorkspacesMenuDebugState {
  currentUser: {
    id?: string;
    username?: string;
    email?: string;
    role?: string;
    name?: string;
    storageConnectionsCount: number;
    activeWorkspaceId?: string;
  } | null;
  accountWorkspaces: UserWorkspaceRecord[];
  activeWorkspace: {
    id: string;
    name: string;
    path: string;
    localFolderKey?: string;
    localFolderName?: string;
  };
  tabs: WorkspaceTab[];
  activeTabId: string;
  modalStates: {
    isWorkspacesMenuOpen: boolean;
    isWorkspaceFolderSelectorOpen: boolean;
    isMediaVaultOpen: boolean;
    isAdminPanelOpen: boolean;
    isSettingsOpen: boolean;
    isVaultExplorerOpen: boolean;
    isLoginOpen: boolean;
    isDebugModalOpen: boolean;
  };
  navigation: {
    viewMode: 'graph' | 'kanban' | 'work' | 'tags' | 'search';
    activeCollectionId: string;
    activeCollectionTitle: string;
  };
}

export interface VaultBrowserDebugState {
  activeVaultName: string;
  vaultPath: string;
  storageProvider: string;
  isCloudPrimary: boolean;
  folderPrefix: string;
  categories: DocCategory[];
  documents: DocumentItem[];
  treeStats: {
    fileCount: number;
    folderCount: number;
  };
  localDirectoryHandle: {
    isConnected: boolean;
    name?: string;
  };
  cloneConnections: UserStorageConnection[];
}

export interface SettingsPreferencesDebugState {
  theme: ThemeMode;
  themeConfig: CustomThemeConfig;
  savedThemesCount: number;
  savedThemesList: Array<{ id: string; name: string }>;
  biome: BiomeType;
  motionEnabled: boolean;
  appWallpaper: string | null;
  autoSaveEnabled: boolean;
  autoSaveClonesEnabled: boolean;
  localFsDeviceError: string | null;
  isLocalFsDisabledForSession: boolean;
}

export interface LocalStorageSyncDebugState {
  rawKeys: Record<string, any>;
  graphCached: {
    present: boolean;
    nodeCount: number;
    edgeCount: number;
    groupCount: number;
    updatedAt?: number;
  };
  activeWorkspaceIdInStorage: string | null;
  workspaceTabsInStorageCount: number;
  activeTabIdInStorage: string | null;
  autoSaveInStorage: boolean;
  autoSaveClonesInStorage: boolean;
}

export interface SyncAuditCheck {
  name: string;
  passed: boolean;
  uiValue: any;
  storageValue: any;
  diff?: string;
}

export interface SyncAuditResult {
  isSynced: boolean;
  syncScorePercent: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  timestamp: number;
  checks: SyncAuditCheck[];
  diffSummary: string[];
}

export interface FullFrontendUiState {
  version: string;
  timestamp: number;
  nodeGraph: NodeGraphDebugState;
  menus: WorkspacesMenuDebugState;
  vaultBrowser: VaultBrowserDebugState;
  settingsAndPreferences: SettingsPreferencesDebugState;
  localStorage: LocalStorageSyncDebugState;
  syncAudit: SyncAuditResult;
}

/**
 * Extracts and parses all docustack-relevant keys from localStorage safely
 */
export function extractLocalStorageSnapshot(): LocalStorageSyncDebugState {
  if (typeof window === 'undefined') {
    return {
      rawKeys: {},
      graphCached: { present: false, nodeCount: 0, edgeCount: 0, groupCount: 0 },
      activeWorkspaceIdInStorage: null,
      workspaceTabsInStorageCount: 0,
      activeTabIdInStorage: null,
      autoSaveInStorage: true,
      autoSaveClonesInStorage: false,
    };
  }

  const rawKeys: Record<string, any> = {};
  const activeWsId = window.localStorage.getItem('docustack_active_workspace_id') || '';

  const knownKeys = [
    'docustackAuthToken',
    'docustack_active_workspace_id',
    'docustack_workspace_name',
    'docustack_workspace_path',
    'docustack_workspace_tabs',
    'docustack_active_tab_id',
    'docustackSavedThemes',
    'activeThemeConfig',
    'appWallpaper',
    'docustack_auto_save',
    'docustack_auto_save_clones',
  ];

  for (const k of knownKeys) {
    const val = window.localStorage.getItem(k);
    if (val !== null) {
      try {
        rawKeys[k] = JSON.parse(val);
      } catch {
        rawKeys[k] = val;
      }
    }
  }

  // Check graph cache for active workspace
  let graphCached = { present: false, nodeCount: 0, edgeCount: 0, groupCount: 0, updatedAt: undefined as number | undefined };
  const graphKey = activeWsId ? `docustack_workspace_graph_${activeWsId}` : 'docustack_workspace_graph_default';
  const cachedGraphRaw = window.localStorage.getItem(graphKey) || window.localStorage.getItem('docustack_workspace_graph_default');
  if (cachedGraphRaw) {
    try {
      const parsed = JSON.parse(cachedGraphRaw);
      graphCached = {
        present: true,
        nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
        edgeCount: Array.isArray(parsed.edges) ? parsed.edges.length : 0,
        groupCount: Array.isArray(parsed.groups) ? parsed.groups.length : 0,
        updatedAt: parsed.updatedAt,
      };
      rawKeys[graphKey] = {
        nodeCount: graphCached.nodeCount,
        edgeCount: graphCached.edgeCount,
        groupCount: graphCached.groupCount,
        updatedAt: graphCached.updatedAt,
      };
    } catch {
      // Ignored
    }
  }

  let workspaceTabsInStorageCount = 0;
  try {
    const tabsRaw = window.localStorage.getItem('docustack_workspace_tabs');
    if (tabsRaw) {
      const parsedTabs = JSON.parse(tabsRaw);
      if (Array.isArray(parsedTabs)) workspaceTabsInStorageCount = parsedTabs.length;
    }
  } catch {}

  const autoSaveRaw = window.localStorage.getItem('docustack_auto_save');
  const autoSaveClonesRaw = window.localStorage.getItem('docustack_auto_save_clones');

  return {
    rawKeys,
    graphCached,
    activeWorkspaceIdInStorage: window.localStorage.getItem('docustack_active_workspace_id'),
    workspaceTabsInStorageCount,
    activeTabIdInStorage: window.localStorage.getItem('docustack_active_tab_id'),
    autoSaveInStorage: autoSaveRaw !== null ? autoSaveRaw === 'true' : true,
    autoSaveClonesInStorage: autoSaveClonesRaw !== null ? autoSaveClonesRaw === 'true' : false,
  };
}

/**
 * Audits 100% synchronization between in-memory React UI state and localStorage / backend state
 */
export function auditFrontendSync(
  nodeGraph: NodeGraphDebugState,
  menus: WorkspacesMenuDebugState,
  settings: SettingsPreferencesDebugState,
  storage: LocalStorageSyncDebugState
): SyncAuditResult {
  const checks: SyncAuditCheck[] = [];
  const diffSummary: string[] = [];

  // Check 1: Graph Nodes Count Sync
  const nodesSynced = storage.graphCached.present
    ? nodeGraph.nodes.length === storage.graphCached.nodeCount
    : nodeGraph.nodes.length === 0;
  checks.push({
    name: 'Node Graph: Node Count Equivalence',
    passed: nodesSynced,
    uiValue: nodeGraph.nodes.length,
    storageValue: storage.graphCached.nodeCount,
    diff: nodesSynced ? undefined : `UI has ${nodeGraph.nodes.length} nodes, storage has ${storage.graphCached.nodeCount}`,
  });
  if (!nodesSynced) {
    diffSummary.push(`Node count mismatch: UI(${nodeGraph.nodes.length}) vs LocalStorage(${storage.graphCached.nodeCount})`);
  }

  // Check 2: Graph Edges Count Sync
  const edgesSynced = storage.graphCached.present
    ? nodeGraph.edges.length === storage.graphCached.edgeCount
    : nodeGraph.edges.length === 0;
  checks.push({
    name: 'Node Graph: Edge Count Equivalence',
    passed: edgesSynced,
    uiValue: nodeGraph.edges.length,
    storageValue: storage.graphCached.edgeCount,
    diff: edgesSynced ? undefined : `UI has ${nodeGraph.edges.length} edges, storage has ${storage.graphCached.edgeCount}`,
  });
  if (!edgesSynced) {
    diffSummary.push(`Edge count mismatch: UI(${nodeGraph.edges.length}) vs LocalStorage(${storage.graphCached.edgeCount})`);
  }

  // Check 3: Active Workspace ID Sync
  const activeWsMatch =
    !menus.activeWorkspace.id ||
    !storage.activeWorkspaceIdInStorage ||
    menus.activeWorkspace.id === storage.activeWorkspaceIdInStorage;
  checks.push({
    name: 'Workspaces: Active Workspace ID Sync',
    passed: activeWsMatch,
    uiValue: menus.activeWorkspace.id,
    storageValue: storage.activeWorkspaceIdInStorage,
    diff: activeWsMatch ? undefined : `UI active workspace is "${menus.activeWorkspace.id}", storage is "${storage.activeWorkspaceIdInStorage}"`,
  });
  if (!activeWsMatch) {
    diffSummary.push(`Active workspace mismatch: UI("${menus.activeWorkspace.id}") vs LocalStorage("${storage.activeWorkspaceIdInStorage}")`);
  }

  // Check 4: Workspace Tabs Count Sync
  const tabsCountMatch =
    menus.tabs.length === 0 ||
    storage.workspaceTabsInStorageCount === 0 ||
    menus.tabs.length === storage.workspaceTabsInStorageCount;
  checks.push({
    name: 'Workspaces: Workspace Tabs Count Sync',
    passed: tabsCountMatch,
    uiValue: menus.tabs.length,
    storageValue: storage.workspaceTabsInStorageCount,
    diff: tabsCountMatch ? undefined : `UI tabs count is ${menus.tabs.length}, storage tabs count is ${storage.workspaceTabsInStorageCount}`,
  });
  if (!tabsCountMatch) {
    diffSummary.push(`Workspace tabs count mismatch: UI(${menus.tabs.length}) vs LocalStorage(${storage.workspaceTabsInStorageCount})`);
  }

  // Check 5: Auto-Save Preference Sync
  const autoSaveMatch = settings.autoSaveEnabled === storage.autoSaveInStorage;
  checks.push({
    name: 'Settings: Auto-Save Preference Match',
    passed: autoSaveMatch,
    uiValue: settings.autoSaveEnabled,
    storageValue: storage.autoSaveInStorage,
    diff: autoSaveMatch ? undefined : `UI autoSave is ${settings.autoSaveEnabled}, storage autoSave is ${storage.autoSaveInStorage}`,
  });
  if (!autoSaveMatch) {
    diffSummary.push(`Auto-save flag mismatch: UI(${settings.autoSaveEnabled}) vs LocalStorage(${storage.autoSaveInStorage})`);
  }

  // Check 6: Auto-Save Clones Preference Sync
  const autoSaveClonesMatch = settings.autoSaveClonesEnabled === storage.autoSaveClonesInStorage;
  checks.push({
    name: 'Settings: Auto-Save Clones Preference Match',
    passed: autoSaveClonesMatch,
    uiValue: settings.autoSaveClonesEnabled,
    storageValue: storage.autoSaveClonesInStorage,
    diff: autoSaveClonesMatch ? undefined : `UI autoSaveClones is ${settings.autoSaveClonesEnabled}, storage autoSaveClones is ${storage.autoSaveClonesInStorage}`,
  });
  if (!autoSaveClonesMatch) {
    diffSummary.push(`Auto-save clones flag mismatch: UI(${settings.autoSaveClonesEnabled}) vs LocalStorage(${storage.autoSaveClonesInStorage})`);
  }

  // Check 7: Graph Save Status Dirty Indicator
  const isGraphSaved = nodeGraph.saveStatus !== 'dirty';
  checks.push({
    name: 'Persistence: Node Graph Unsaved Mutations Check',
    passed: isGraphSaved,
    uiValue: nodeGraph.saveStatus,
    storageValue: 'saved',
    diff: isGraphSaved ? undefined : 'Node graph has pending uncommitted mutations (dirty state)',
  });
  if (!isGraphSaved) {
    diffSummary.push('Node graph is currently DIRTY with uncommitted mutations.');
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const failedChecks = totalChecks - passedChecks;
  const syncScorePercent = Math.round((passedChecks / totalChecks) * 100);

  return {
    isSynced: failedChecks === 0,
    syncScorePercent,
    totalChecks,
    passedChecks,
    failedChecks,
    timestamp: Date.now(),
    checks,
    diffSummary,
  };
}

/**
 * Filter sections from full state
 */
export function filterDebugStateSection(state: FullFrontendUiState, section?: string): any {
  if (!section || section === 'all') return state;
  const clean = section.toLowerCase().trim();
  switch (clean) {
    case 'nodegraph':
    case 'graph':
    case 'nodes':
      return state.nodeGraph;
    case 'menus':
    case 'workspaces':
    case 'account':
      return state.menus;
    case 'vault':
    case 'vaultbrowser':
    case 'files':
      return state.vaultBrowser;
    case 'settings':
    case 'preferences':
    case 'theme':
      return state.settingsAndPreferences;
    case 'localstorage':
    case 'storage':
      return state.localStorage;
    case 'sync':
    case 'syncaudit':
    case 'audit':
      return state.syncAudit;
    default:
      return state;
  }
}

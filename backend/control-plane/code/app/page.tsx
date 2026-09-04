'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DocCategory, DocumentItem, BiomeType, ThemeMode, GraphNode, GraphEdge, GraphGroup, WorkspaceTab, CustomThemeConfig, UserAccount, UserWorkspaceRecord, UserStorageConnection } from '../lib/types';
import { INITIAL_CATEGORIES, INITIAL_DOCUMENTS, INITIAL_NODES, INITIAL_EDGES, DEFAULT_THEME_PRESETS, applyThemeVariables } from '../lib/theme';
import { requestApi } from '../lib/api-client';
import { getLocalDirectoryHandle, syncWorkspaceToDirectoryHandle, removeEntryFromLocalHandle, autoInitializeLocalDirectory, getActiveLocalDirectoryHandle } from '../lib/local-fs-handle';
import { formatCanonicalWorkspaceFolderName } from '../lib/workspace-canonical';
import BiomeCanvas from '../components/BiomeCanvas';
import Header from '../components/Header';
import LoginScreen from '../components/auth/LoginScreen';
import WorkspaceViewRouter from '../components/workspace/WorkspaceViewRouter';
import WorkspaceModalsContainer from '../components/workspace/WorkspaceModalsContainer';
import { useWorkspaceTheme } from '../hooks/useWorkspaceTheme';
import { useWorkspacePersistence } from '../hooks/useWorkspacePersistence';

function getDescendantNodeIds(rootId: string, allEdges: GraphEdge[]): string[] {
  const descendantIds = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of allEdges) {
      if (descendantIds.has(edge.source) && !descendantIds.has(edge.target)) {
        descendantIds.add(edge.target);
        changed = true;
      }
    }
  }
  return Array.from(descendantIds);
}

const DEFAULT_WORKSPACES: WorkspaceTab[] = [
  {
    id: 'ws-main',
    name: 'MAIN DESK',
    tiles: [
      { id: 'tile-1', width: 540, height: 480, activeDocId: 'browser' },
      { id: 'tile-2', width: 540, height: 480, activeDocId: 'doc-1' },
    ],
    createdAt: 1700000000000,
  },
];

export default function DocumentStorageViewer() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'graph' | 'kanban' | 'work' | 'tags' | 'search'>('graph');
  const [transitionTargetMode, setTransitionTargetMode] = useState<'graph' | 'kanban' | 'work' | 'tags' | 'search' | null>(null);
  const [transitionKey, setTransitionKey] = useState<string | null>(null);

  const transitionToViewMode = (mode: 'graph' | 'kanban' | 'work' | 'tags' | 'search') => {
    setTransitionTargetMode(mode);
    setTransitionKey(`${mode}-${Date.now()}-${Math.random()}`);
  };
  const [activeCollectionId, setActiveCollectionId] = useState<string>('kanban-main');
  const [activeCollectionTitle, setActiveCollectionTitle] = useState<string>('CORE_KANBAN_BOARD');

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [groups, setGroups] = useState<GraphGroup[]>([]);

  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceTab[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-main');
  const [focusTarget, setFocusTarget] = useState<{ type: 'node' | 'group'; id: string; timestamp: number } | null>(null);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title?: string;
    itemName: string;
    itemType: 'stack' | 'folder' | 'node' | 'document';
    documentCount?: number;
    warningText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    doc: DocumentItem;
    x: number;
    y: number;
  } | null>(null);
  const [workspaceToast, setWorkspaceToast] = useState<string | null>(null);

  // User Authentication, Workspace Folder, & Media Modals State
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<Omit<UserAccount, 'passwordHash'> | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isWorkspacesMenuOpen, setIsWorkspacesMenuOpen] = useState(false);
  const [isMediaVaultOpen, setIsMediaVaultOpen] = useState(false);
  const [isWorkspaceFolderSelectorOpen, setIsWorkspaceFolderSelectorOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Compute active clones
  const userStorageConnections: UserStorageConnection[] =
    currentUser?.appProfiles?.docustack?.storage_connections || (currentUser as any)?.storage_connections || [];
  const cloneConnections = userStorageConnections.filter((c) => c.role !== 'primary');
  const cloneCount = cloneConnections.length;

  const [localFsDeviceError, setLocalFsDeviceError] = useState<string | null>(null);
  const [isLocalFsDisabledForSession, setIsLocalFsDisabledForSession] = useState<boolean>(false);

  // Modular Workspace Theme & Wallpaper Hook
  const {
    theme,
    setTheme,
    themeConfig,
    savedThemes,
    biome,
    setBiome,
    motionEnabled,
    setMotionEnabled,
    appWallpaper,
    canvasWallpaperInputRef,
    handleChangeThemeConfig,
    handleSaveCustomTheme,
    handleDeleteCustomTheme,
    handleChangeWallpaper,
    handleUploadCanvasWallpaperFile,
    handleDeleteCanvasWallpaperFile,
  } = useWorkspaceTheme(setWorkspaceToast);

  // Modular Workspace Multi-Tier Persistence & Sync Hook
  const {
    saveStatus,
    autoSaveEnabled,
    autoSaveClonesEnabled,
    handleSaveAll,
    cancelPendingSave,
    handleToggleAutoSave,
    handleToggleAutoSaveClones,
    triggerWorkspaceMutationSave,
  } = useWorkspacePersistence({
    nodes,
    edges,
    groups,
    categories,
    documents,
    currentUser,
    activeWorkspaceId,
    cloneConnections,
    isLocalFsDisabledForSession,
    setWorkspaceToast,
  });

  // Auto-dismiss localFsDeviceError after 6.5 seconds
  useEffect(() => {
    if (!localFsDeviceError) return;
    const timer = setTimeout(() => {
      setLocalFsDeviceError(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [localFsDeviceError]);

  // Proactive zero-click local storage initialization on app load / auth check
  useEffect(() => {
    if (!currentUser) return;

    const activeWs = currentUser.workspaces?.find((w) => w.id === (currentUser.activeWorkspaceId || activeWorkspaceId));

    // Check if user has actually configured a local storage setting (tile)
    const userConns = [
      ...(currentUser.appProfiles?.docustack?.storage_connections || []),
      ...((currentUser as any).storage_connections || []),
    ];
    const savedLocalConn = userConns.find((c: any) => c && c.provider === 'local_fs');
    const localClones = cloneConnections.filter((c) => c.provider === 'local_fs');

    const hasWorkspaceLocalKey = Boolean(activeWs?.localFolderKey && activeWs.localFolderKey.trim().length > 0);
    const hasSavedLocalConnTile = Boolean(savedLocalConn && (savedLocalConn.localFolderKey || (savedLocalConn.label && savedLocalConn.label.trim().length > 0)));
    const hasLocalClone = localClones.length > 0 && Boolean(localClones[0]?.localFolderKey);

    // If there is no saved local storage setting (tile) that the user has set up, do not show error banner
    if (!hasWorkspaceLocalKey && !hasSavedLocalConnTile && !hasLocalClone) {
      setIsLocalFsDisabledForSession(false);
      setLocalFsDeviceError(null);
      return;
    }

    const isLocalPrimary =
      activeWs?.storageProvider === 'local_fs' ||
      (!activeWs?.storageProvider && Boolean(activeWs?.localFolderKey)) ||
      (savedLocalConn?.role === 'primary');

    const localTarget = isLocalPrimary
      ? {
          key: activeWs?.localFolderKey || savedLocalConn?.localFolderKey,
          name: activeWs?.localFolderName || savedLocalConn?.localFolderName || activeWs?.name || 'Local Workspace',
        }
      : (localClones[0]
          ? { key: localClones[0].localFolderKey, name: localClones[0].localFolderName || localClones[0].label }
          : (savedLocalConn
              ? { key: savedLocalConn.localFolderKey, name: savedLocalConn.localFolderName || savedLocalConn.label || 'Local Workspace' }
              : null));

    if (localTarget) {
      if (!localTarget.key) {
        setIsLocalFsDisabledForSession(true);
        setLocalFsDeviceError(`Local storage folder "${localTarget.name}" has no registered directory handle on this machine. Local storage is disabled for this session.`);
        return;
      }

      autoInitializeLocalDirectory(localTarget.key, localTarget.name).then((res) => {
        if (res.status === 'connected') {
          setIsLocalFsDisabledForSession(false);
          setLocalFsDeviceError(null);
        } else if (res.status === 'unavailable_on_machine') {
          setIsLocalFsDisabledForSession(true);
          setLocalFsDeviceError(`Local storage folder "${localTarget.name}" is not available on this machine. Local storage is disabled for this session.`);
        } else if (res.status === 'permission_denied') {
          setIsLocalFsDisabledForSession(true);
          setLocalFsDeviceError(`Browser permission for folder "${localTarget.name}" has not been granted. Local storage disabled for this session.`);
        } else {
          setIsLocalFsDisabledForSession(true);
          setLocalFsDeviceError(`Local storage error: ${res.message || 'Could not connect to local folder.'}`);
        }
      });
    } else {
      setIsLocalFsDisabledForSession(false);
      setLocalFsDeviceError(null);
    }
  }, [currentUser?.id, currentUser?.activeWorkspaceId, activeWorkspaceId, cloneConnections.length]);

  const loadUserWorkspaceData = () => {
    const activeWsName =
      currentUser?.workspaceName ||
      (typeof window !== 'undefined' ? localStorage.getItem('docustack_workspace_name') : null) ||
      'DocuStack Vault';

    requestApi<{ nodes: GraphNode[]; edges: GraphEdge[]; groups: GraphGroup[] }>('/api/graph', undefined, 'INIT_GRAPH')
      .then((data) => {
        if (data?.nodes) {
          const mappedNodes = data.nodes.map((n) =>
            n.isWorkspaceRoot ? { ...n, title: activeWsName } : n
          );
          setNodes(mappedNodes);
        }
        if (data?.edges) setEdges(data.edges);
        if (data?.groups) setGroups(data.groups);
      })
      .catch(() => {});

    requestApi<{ categories: DocCategory[] }>('/api/categories', undefined, 'INIT_CATEGORIES')
      .then((data) => data?.categories && setCategories(data.categories))
      .catch(() => {});

    refreshDocuments();
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('docustackAuthToken');
      if (!token) {
        setAuthChecked(true);
        loadUserWorkspaceData();
        return;
      }
      setUserToken(token);
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      fetch('/api/auth/me', { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            if (data.user.role === 'admin') {
              router.push('/admin');
              return;
            }
            setCurrentUser(data.user);
            if (data.user.workspacePath) {
              localStorage.setItem('docustack_workspace_path', data.user.workspacePath);
            }
            if (data.user.workspaceName) {
              localStorage.setItem('docustack_workspace_name', data.user.workspaceName);
            }
            const activeId = data.user.activeWorkspaceId || data.user.workspaces?.[0]?.id;
            if (activeId) {
              setActiveWorkspaceId(activeId);
              localStorage.setItem('docustack_active_workspace_id', activeId);
            }
            if (!data.user.workspaces || data.user.workspaces.length === 0) {
              setIsWorkspacesMenuOpen(true);
            }
            loadUserWorkspaceData();
          } else {
            localStorage.removeItem('docustackAuthToken');
          }
        })
        .catch((err) => console.error('Failed to load user auth session:', err))
        .finally(() => {
          setAuthChecked(true);
        });
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleLoginSuccess = (
    user: Omit<UserAccount, 'passwordHash'>,
    token: string
  ) => {
    setCurrentUser(user);
    setUserToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('docustackAuthToken', token);
      if (user.workspacePath) {
        localStorage.setItem('docustack_workspace_path', user.workspacePath);
      }
      if (user.workspaceName) {
        localStorage.setItem('docustack_workspace_name', user.workspaceName);
      }
    }
    loadUserWorkspaceData();
    setIsLoginOpen(false);
    // User login -> Workspaces tiles menu flow
    setIsWorkspacesMenuOpen(true);
  };

  const handleEnterWorkspace = async (workspace: UserWorkspaceRecord) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const currentWorkspaces = prev.workspaces || [];
      const hasWorkspace = currentWorkspaces.some((w) => w.id === workspace.id);
      const updatedWorkspaces = hasWorkspace
        ? currentWorkspaces.map((w) => (w.id === workspace.id ? workspace : w))
        : [...currentWorkspaces, workspace];

      return {
        ...prev,
        activeWorkspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        workspaceName: workspace.name,
        workspaces: updatedWorkspaces,
        appProfiles: {
          ...(prev.appProfiles || {}),
          docustack: {
            ...(prev.appProfiles?.docustack || {}),
            activeWorkspaceId: workspace.id,
            workspacePath: workspace.workspacePath,
            workspaceName: workspace.name,
            workspaces: updatedWorkspaces,
          },
        },
      };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('docustack_active_workspace_id', workspace.id);
      localStorage.setItem('docustack_workspace_path', workspace.workspacePath);
      localStorage.setItem('docustack_workspace_name', workspace.name);
    }

    // Immediately update root node on screen so it displays the active workspace name
    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.isWorkspaceRoot ? { ...n, title: workspace.name, workspacePath: workspace.workspacePath } : n
      )
    );

    try {
      await requestApi('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({
          action: 'configure',
          workspacePath: workspace.workspacePath,
          workspaceName: workspace.name,
          workspaceId: workspace.id,
          storageConnectionId: workspace.storageConnectionId,
          storageProvider: workspace.storageProvider,
          userId: currentUser?.id,
        }),
      }, 'CONFIGURE_WORKSPACE');
    } catch (e) {
      console.warn('Workspace sync notification:', e);
    }

    loadUserWorkspaceData();
    setIsWorkspacesMenuOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserToken(null);
    setDocuments([]);
    setCategories([]);
    setNodes([]);
    setEdges([]);
    setGroups([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('docustackAuthToken');
      localStorage.removeItem('docustack_active_workspace_id');
      localStorage.removeItem('docustack_workspace_path');
      localStorage.removeItem('docustack_workspace_name');
    }
    setIsLoginOpen(false);
    setIsWorkspacesMenuOpen(false);
  };



  const handleSetCategoryWallpaperFile = async (category: DocCategory, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', 'column');
    formData.append('subDir', `${activeCollectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/${category.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
    try {
      const res = await fetch('/api/wallpapers', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.wallpaperUrl) {
        const updatedCat = { ...category, wallpaper: data.wallpaperUrl, isWallpaperManual: true };
        setCategories((prev) => prev.map((c) => (c.id === category.id ? updatedCat : c)));
        requestApi('/api/categories', { method: 'PUT', body: JSON.stringify(updatedCat) }, 'UPDATE_CATEGORY');
        setWorkspaceToast(`[STACK WALLPAPER UPDATED] SAVED TO WORKSPACE VAULT: ${category.title}`);
        setTimeout(() => setWorkspaceToast(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [activeDocSearchQuery, setActiveDocSearchQuery] = useState<string>('');
  const [chatDoc, setChatDoc] = useState<DocumentItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<DocCategory | null | 'NEW'>(null);
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVaultExplorerOpen, setIsVaultExplorerOpen] = useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [docToAddToWorkspace, setDocToAddToWorkspace] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('docustack_workspace_tabs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWorkspaces(parsed);
          }
        }
        const storedActive = localStorage.getItem('docustack_active_workspace_id');
        if (storedActive) {
          setActiveWorkspaceId(storedActive);
        }
      } catch {}
    }
  }, []);

  const handleUpdateWorkspaces = (newWorkspaces: WorkspaceTab[]) => {
    setWorkspaces(newWorkspaces);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('docustack_workspace_tabs', JSON.stringify(newWorkspaces));
      } catch {}
    }
  };

  const handleSelectWorkspaceId = (id: string) => {
    setActiveWorkspaceId(id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('docustack_active_workspace_id', id);
      } catch {}
    }
  };

  const refreshDocuments = () => {
    requestApi<{ documents: DocumentItem[] }>('/api/documents', undefined, 'REFRESH_DOCS')
      .then((data) => data?.documents && setDocuments(data.documents))
      .catch(() => {});
  };

  const handleAssetPurged = useCallback(
    (payload: {
      type: 'file' | 'folder';
      path: string;
      purgedDocIds?: string[];
      purgedCategoryIds?: string[];
      purgedNodeIds?: string[];
    }) => {
      if (payload.purgedDocIds && payload.purgedDocIds.length > 0) {
        setDocuments((prev) => prev.filter((d) => !payload.purgedDocIds!.includes(d.id)));
        if (activeDoc && payload.purgedDocIds.includes(activeDoc.id)) {
          setActiveDoc(null);
        }
      }

      if (payload.purgedCategoryIds && payload.purgedCategoryIds.length > 0) {
        setCategories((prev) => prev.filter((c) => !payload.purgedCategoryIds!.includes(c.id)));
      }

      if (payload.purgedNodeIds && payload.purgedNodeIds.length > 0) {
        setNodes((prev) => prev.filter((n) => !payload.purgedNodeIds!.includes(n.id)));
        setEdges((prev) =>
          prev.filter(
            (e) =>
              !payload.purgedNodeIds!.includes(e.source) &&
              !payload.purgedNodeIds!.includes(e.target)
          )
        );
      }

      cancelPendingSave();
      loadUserWorkspaceData();
      refreshDocuments();
    },
    [activeDoc, cancelPendingSave]
  );



  const handleOpenWorkspaceFolder = () => {
    setIsVaultExplorerOpen(true);
  };

  const handleAddGraphNode = (newNode: GraphNode, newEdge?: GraphEdge) => {
    setNodes((prev) => {
      const exists = prev.some((n) => n.id === newNode.id);
      return exists ? prev : [...prev, newNode];
    });
    if (newEdge) {
      setEdges((prev) => {
        const exists = prev.some((e) => e.id === newEdge.id || (e.source === newEdge.source && e.target === newEdge.target));
        return exists ? prev : [...prev, newEdge];
      });
    }
    requestApi('/api/graph', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADD_NODE', node: newNode, edge: newEdge }),
    }, 'ADD_GRAPH_NODE');

    if (newNode.type === 'collection') {
      const boardId = newNode.collectionId || newNode.id;
      // Initialize a standard 3-column empty workflow for this fresh Kanban board
      const defaultCols: DocCategory[] = [
        {
          id: `cat-${Date.now()}-todo`,
          boardId,
          title: 'To Do',
          glyph: 'Inbox',
          color: newNode.color || '#D4AF37',
          description: 'Tasks and documents to start',
        },
        {
          id: `cat-${Date.now()}-progress`,
          boardId,
          title: 'In Progress',
          glyph: 'Flame',
          color: '#B59443',
          description: 'Active tasks and documents',
        },
        {
          id: `cat-${Date.now()}-done`,
          boardId,
          title: 'Done',
          glyph: 'Shield',
          color: '#2A9D8F',
          description: 'Completed items',
        },
      ];

      setCategories((prev) => [...prev, ...defaultCols]);
      for (const col of defaultCols) {
        requestApi('/api/categories', {
          method: 'POST',
          body: JSON.stringify(col),
        }, 'CREATE_STACK');
      }
    }

    triggerWorkspaceMutationSave();
  };

  const handleUpdateGraphNode = (updatedNode: GraphNode, isDragging = false) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    if (updatedNode.type === 'collection') {
      const boardId = updatedNode.collectionId || updatedNode.id;
      if (activeCollectionId === boardId) {
        setActiveCollectionTitle(updatedNode.title);
      }
    }
    if (!isDragging) {
      requestApi('/api/graph', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_NODE', node: updatedNode }),
      }, 'UPDATE_GRAPH_NODE');
      triggerWorkspaceMutationSave();
    }
  };

  const purgeFromAllLocalHandles = async (pathsToPurge: string[]) => {
    if (!pathsToPurge || pathsToPurge.length === 0) return;
    const currentWs = currentUser?.workspaces?.find(
      (w) => w.id === (currentUser.activeWorkspaceId || activeWorkspaceId)
    );
    const uName = currentUser?.username || currentUser?.name || 'user';
    const subfolder =
      currentWs?.workspacePath?.replace(/^\.\//, '') ||
      (currentWs?.name ? formatCanonicalWorkspaceFolderName('docustack', uName, currentWs.name) : '') ||
      currentUser?.workspacePath?.replace(/^\.\//, '') ||
      'workspace';

    const localTargets: { key?: string }[] = [];
    if (currentWs?.localFolderKey) {
      localTargets.push({ key: currentWs.localFolderKey });
    }
    const userConns: any[] = [
      ...userStorageConnections,
      ...(currentUser?.appProfiles?.docustack?.storage_connections || []),
      ...((currentUser as any)?.storage_connections || []),
    ];
    for (const c of userConns) {
      if (c.provider === 'local_fs' && c.localFolderKey) {
        localTargets.push({ key: c.localFolderKey });
      }
    }

    const sweptKeys = new Set<string>();
    for (const target of localTargets) {
      if (!target.key || sweptKeys.has(target.key)) continue;
      sweptKeys.add(target.key);
      try {
        const handle = await getLocalDirectoryHandle(target.key);
        if (handle) {
          for (const path of pathsToPurge) {
            await removeEntryFromLocalHandle(handle, path, subfolder);
          }
        }
      } catch (e) {
        console.warn('[LocalFS] Purge error for key:', target.key, e);
      }
    }

    const activeMemHandle = getActiveLocalDirectoryHandle();
    if (activeMemHandle) {
      try {
        for (const path of pathsToPurge) {
          await removeEntryFromLocalHandle(activeMemHandle, path, subfolder);
        }
      } catch (e) {
        console.warn('[LocalFS] Purge error for active memory handle:', e);
      }
    }
  };

  const executeDeleteGraphNode = async (id: string) => {
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode || targetNode.isWorkspaceRoot) return;

    const descendantIds = getDescendantNodeIds(id, edges);
    const descendantNodes = nodes.filter((n) => descendantIds.includes(n.id));

    // Find any collection nodes in the deleted branch to purge
    const purgedCatIds = descendantNodes
      .filter((n) => n.type === 'collection' || n.collectionId)
      .map((n) => n.collectionId || n.id);

    const updatedDocs = documents.filter((d) => !purgedCatIds.includes(d.categoryId));
    const updatedCats = categories.filter((c) => !purgedCatIds.includes(c.id));
    const updatedNodes = nodes.filter((n) => !descendantIds.includes(n.id));
    const updatedEdges = edges.filter((e) => !descendantIds.includes(e.source) && !descendantIds.includes(e.target));
    const updatedGroups = groups
      .map((g) => ({
        ...g,
        nodeIds: g.nodeIds.filter((nid) => !descendantIds.includes(nid)),
      }))
      .filter((g) => g.nodeIds.length > 0);

    if (purgedCatIds.length > 0) {
      setDocuments(updatedDocs);
      setCategories(updatedCats);
    }
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setGroups(updatedGroups);

    setConfirmModalState(null);
    cancelPendingSave();
    setWorkspaceToast(`[PURGING...] REMOVING ASSETS FROM ALL STORAGES`);

    try {
      const res: any = await requestApi('/api/graph', {
        method: 'POST',
        body: JSON.stringify({ action: 'DELETE_NODE', id }),
      }, 'DELETE_GRAPH_NODE');

      // Purge matching paths from all connected local_fs directory handles
      const purgedPaths: string[] = res?.purgedPaths || [];
      if (targetNode.title) purgedPaths.push(targetNode.title);
      for (const desc of descendantNodes) {
        if (desc.title) purgedPaths.push(desc.title);
      }

      await purgeFromAllLocalHandles(purgedPaths);

      setWorkspaceToast(`[PURGED] NODE & ASSETS REMOVED FROM ALL STORAGES`);
      setTimeout(() => setWorkspaceToast(null), 3000);

      // Replicate with explicit updated state to all storages and local handles
      handleSaveAll({
        nodes: updatedNodes,
        edges: updatedEdges,
        groups: updatedGroups,
        categories: updatedCats,
        documents: updatedDocs,
      });
    } catch (err: any) {
      console.error('Failed to delete node:', err);
      setWorkspaceToast(`[DELETE ERROR] ${err?.message || 'Failed to delete'}`);
      setTimeout(() => setWorkspaceToast(null), 3500);
    }
  };

  const requestDeleteGraphNode = (id: string) => {
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode || targetNode.isWorkspaceRoot) return;

    if (targetNode.type === 'collection') {
      const boardId = targetNode.collectionId || targetNode.id;
      const boardCols = categories.filter((c) => c.boardId === boardId || c.id === boardId);
      const colIds = boardCols.map((c) => c.id);
      const totalDocs = documents.filter((d) => colIds.includes(d.categoryId)).length;

      setConfirmModalState({
        isOpen: true,
        title: 'PURGE KANBAN BOARD',
        itemName: targetNode.title,
        itemType: 'stack',
        documentCount: totalDocs,
        warningText: `Deleting Kanban board '${targetNode.title}' will permanently delete all ${boardCols.length} columns and purge ${totalDocs} document(s) from disk storage.`,
        onConfirm: () => executeDeleteKanbanBoard(boardId),
      });
      return;
    }

    if (targetNode.type === 'folder') {
      const descendantIds = getDescendantNodeIds(id, edges);
      const descendantNodes = nodes.filter((n) => descendantIds.includes(n.id));
      const descendantCollections = descendantNodes.filter((n) => n.type === 'collection' || n.collectionId);
      const catIds = descendantCollections.map((c) => c.collectionId || c.id);
      const totalDocs = documents.filter((d) => catIds.includes(d.categoryId)).length;

      setConfirmModalState({
        isOpen: true,
        title: 'PURGE FOLDER VAULT',
        itemName: targetNode.title,
        itemType: 'folder',
        documentCount: totalDocs,
        warningText: `Deleting folder '${targetNode.title}' will permanently delete this folder, ${descendantCollections.length} connected stack(s), and purge ${totalDocs} document(s) from disk storage.`,
        onConfirm: () => executeDeleteGraphNode(id),
      });
      return;
    }

    // Sticky note or generic node
    setConfirmModalState({
      isOpen: true,
      title: 'DELETE STICKY NOTE',
      itemName: targetNode.title,
      itemType: 'node',
      warningText: `Are you sure you want to delete note '${targetNode.title}'?`,
      onConfirm: () => executeDeleteGraphNode(id),
    });
  };

  const executeDeleteMultipleGraphNodes = async (ids: string[]) => {
    const deletableIds = ids.filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node && !node.isWorkspaceRoot;
    });

    if (deletableIds.length === 0) return;

    // Collect all descendant IDs for all selected nodes
    const allToDeleteNodeIds = new Set<string>();
    for (const id of deletableIds) {
      const descendants = getDescendantNodeIds(id, edges);
      descendants.forEach((d) => allToDeleteNodeIds.add(d));
    }

    const descendantNodes = nodes.filter((n) => allToDeleteNodeIds.has(n.id));
    const purgedCatIds = descendantNodes
      .filter((n) => n.type === 'collection' || n.collectionId)
      .map((n) => n.collectionId || n.id);

    const updatedDocs = documents.filter((d) => !purgedCatIds.includes(d.categoryId));
    const updatedCats = categories.filter((c) => !purgedCatIds.includes(c.id));
    const updatedNodes = nodes.filter((n) => !allToDeleteNodeIds.has(n.id));
    const updatedEdges = edges.filter((e) => !allToDeleteNodeIds.has(e.source) && !allToDeleteNodeIds.has(e.target));
    const updatedGroups = groups
      .map((g) => ({
        ...g,
        nodeIds: g.nodeIds.filter((nid) => !allToDeleteNodeIds.has(nid)),
      }))
      .filter((g) => g.nodeIds.length > 0);

    if (purgedCatIds.length > 0) {
      setDocuments(updatedDocs);
      setCategories(updatedCats);
    }
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setGroups(updatedGroups);

    setWorkspaceToast(`[PURGING...] REMOVING ${deletableIds.length} NODE(S) FROM ALL STORAGES`);

    const allPurgedPaths: string[] = [];
    for (const desc of descendantNodes) {
      if (desc.title) allPurgedPaths.push(desc.title);
    }

    for (const id of deletableIds) {
      try {
        const res: any = await requestApi('/api/graph', {
          method: 'POST',
          body: JSON.stringify({ action: 'DELETE_NODE', id }),
        }, 'DELETE_GRAPH_NODE');
        if (res?.purgedPaths) allPurgedPaths.push(...res.purgedPaths);
      } catch (e) {
        console.error('Delete node error:', e);
      }
    }

    // Remove from local directory handles
    await purgeFromAllLocalHandles(allPurgedPaths);

    setWorkspaceToast(`[PURGED] ${deletableIds.length} NODE(S) REMOVED`);
    setTimeout(() => setWorkspaceToast(null), 3000);

    handleSaveAll();
  };

  const handleSaveGroups = (updatedGroups: GraphGroup[]) => {
    setGroups(updatedGroups);
    requestApi('/api/graph', {
      method: 'POST',
      body: JSON.stringify({ action: 'SAVE_GROUPS', groups: updatedGroups }),
    }, 'SAVE_GROUPS');
    triggerWorkspaceMutationSave();
  };

  const handleFileUpload = async (files: FileList | null, targetCatId?: string) => {
    if (!files || files.length === 0) return;
    const catId = targetCatId || categories[0]?.id || 'cat-inbox';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let fType: DocumentItem['fileType'] = 'other';
      if (['pdf'].includes(ext)) fType = 'pdf';
      else if (['xls', 'xlsx', 'csv'].includes(ext)) fType = 'sheet';
      else if (['js', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'md'].includes(ext)) fType = 'code';
      else if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) fType = 'image';
      else if (['txt', 'doc', 'docx'].includes(ext)) fType = 'text';

      let textContent = '';
      try {
        if (file.type.startsWith('text/') || ['md', 'json', 'ts', 'js', 'py', 'txt'].includes(ext)) {
          textContent = await file.text();
        } else {
          textContent = `BINARY_PAYLOAD: [${file.name}]\nSIZE: ${(file.size / 1024).toFixed(1)} KB`;
        }
      } catch {
        textContent = `FILE_READ_EXCEPTION: ${file.name}`;
      }

      const newDoc: DocumentItem = {
        id: `doc-${Date.now()}-${i}`,
        categoryId: catId,
        title: file.name.toUpperCase(),
        description: `Imported file payload (${fType})`,
        content: textContent,
        fileType: fType,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toISOString().split('T')[0],
        tags: [fType.toUpperCase(), 'IMPORTED'],
      };

      setDocuments((prev) => [newDoc, ...prev]);
      requestApi('/api/documents', { method: 'POST', body: JSON.stringify(newDoc) }, 'IMPORT_DOC');
    }
    triggerWorkspaceMutationSave();
  };

  const handleQuickNlpAnalyze = async (doc: DocumentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsAnalyzing(true);
    try {
      const res: any = await requestApi('/api/analyze-doc', {
        method: 'POST',
        body: JSON.stringify({
          title: doc.title,
          content: doc.content,
          fileType: doc.fileType,
          currentCategories: categories,
        }),
      }, 'NLP_ANALYZE');

      if (res?.summary) {
        const updatedTags = Array.from(new Set([...doc.tags, ...(res.tags || [])]));
        const updated = { ...doc, nlpSummary: res.summary, tags: updatedTags };
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
        if (activeDoc?.id === doc.id) setActiveDoc(updated);
        requestApi('/api/documents', { method: 'PUT', body: JSON.stringify(updated) }, 'UPDATE_DOC');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSend = async (query: string) => {
    if (!chatDoc) return '';
    const res: any = await requestApi('/api/chat-doc', {
      method: 'POST',
      body: JSON.stringify({
        documentTitle: chatDoc.title,
        documentContent: chatDoc.content,
        messages: [{ text: query }],
      }),
    }, 'NLP_QUERY');
    return res?.text || '[NO_RESPONSE]';
  };

  const handleDeleteDoc = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetDoc = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);

    requestApi(`/api/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, 'DELETE_DOC').catch(() => {});

    if (targetDoc) {
      const safeTitle = (targetDoc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;
      const assignedCat = categories.find((c) => c.id === targetDoc.categoryId);
      let targetPath = `inbox/${filename}`;
      if (assignedCat) {
        const catFolder = assignedCat.title.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (assignedCat.boardId) {
          const boardNode = nodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
          const boardFolder = (boardNode?.title || 'Kanban').replace(/[^a-zA-Z0-9_-]/g, '_');
          targetPath = `${boardFolder}/${catFolder}/${filename}`;
        } else {
          targetPath = `${catFolder}/${filename}`;
        }
      }

      await purgeFromAllLocalHandles([targetPath]);
    }

    handleSaveAll();
  };

  const handleUpdateDoc = (id: string, updates: Partial<DocumentItem>) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    if (activeDoc?.id === id) setActiveDoc((prev) => (prev ? { ...prev, ...updates } : null));
    requestApi('/api/documents', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, 'UPDATE_DOC').catch(() => {});
    triggerWorkspaceMutationSave();
  };

  const handleAddToWorkSpace = (doc: DocumentItem) => {
    setDocToAddToWorkspace(doc);
  };

  const handleConfirmAddToWorkspace = (workspaceId: string) => {
    if (!docToAddToWorkspace) return;
    const targetWs = workspaces.find((w) => w.id === workspaceId);
    if (!targetWs) return;

    const newTile = {
      id: `tile-${Date.now()}`,
      width: 540,
      height: 480,
      activeDocId: docToAddToWorkspace.id,
    };

    const updatedTiles = [...(targetWs.tiles || []), newTile];
    const updatedWorkspaces = workspaces.map((w) =>
      w.id === workspaceId ? { ...w, tiles: updatedTiles } : w
    );
    handleUpdateWorkspaces(updatedWorkspaces);
    setWorkspaceToast(`[WORK DESK] ADDED '${docToAddToWorkspace.title.toUpperCase()}' TO '${targetWs.name.toUpperCase()}'`);
    setDocToAddToWorkspace(null);
    setTimeout(() => setWorkspaceToast(null), 3000);
  };

  const handleAddStackToWorkspace = (cat: DocCategory) => {
    const stackDocs = documents.filter((d) => d.categoryId === cat.id);
    const newWsId = `ws-stack-${Date.now()}`;
    const newTiles = stackDocs.length > 0
      ? stackDocs.map((d, idx) => ({
          id: `tile-stack-${d.id}-${idx}`,
          width: 540,
          height: 480,
          activeDocId: d.id,
        }))
      : [{ id: `tile-${Date.now()}`, width: 540, height: 480, activeDocId: 'browser' as const }];

    const newTab: WorkspaceTab = {
      id: newWsId,
      name: `STACK: ${cat.title}`,
      tiles: newTiles,
      createdAt: Date.now(),
    };

    const nextWorkspaces = [...workspaces, newTab];
    handleUpdateWorkspaces(nextWorkspaces);
    handleSelectWorkspaceId(newWsId);
    transitionToViewMode('work');
    setWorkspaceToast(`[WORKSPACE CREATED] OPENED '${cat.title.toUpperCase()}' STACK IN NEW WORKSPACE (${stackDocs.length} TILES)`);
    setTimeout(() => setWorkspaceToast(null), 3500);
  };

  const handleAddDocFromWeb = (doc: DocumentItem) => {
    setDocuments((prev) => [doc, ...prev]);
    requestApi('/api/documents', { method: 'POST', body: JSON.stringify(doc) }, 'ADD_WEB_DOC').catch(() => {});

    const currentWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
    if (currentWs) {
      const newTile = {
        id: `tile-${Date.now()}`,
        width: 540,
        height: 480,
        activeDocId: doc.id,
      };
      const updatedTiles = [...(currentWs.tiles || []), newTile];
      const updatedWorkspaces = workspaces.map((w) =>
        w.id === currentWs.id ? { ...w, tiles: updatedTiles } : w
      );
      handleUpdateWorkspaces(updatedWorkspaces);
    }

    setWorkspaceToast(`[WORK DESK] SAVED '${doc.title.toUpperCase()}'`);
    setTimeout(() => setWorkspaceToast(null), 3000);
  };

  const handleSaveCategory = async (data: Partial<DocCategory>) => {
    if (editingCategory === 'NEW') {
      const catId = `cat-${Date.now()}`;
      const newCat: DocCategory = {
        id: catId,
        boardId: activeCollectionId,
        title: data.title || 'NEW_COLUMN',
        glyph: data.glyph || 'Folder',
        color: data.color || '#D4AF37',
        wallpaper: data.wallpaper,
        isWallpaperManual: data.isWallpaperManual,
      };
      setCategories((prev) => [...prev, newCat]);

      const res: any = await requestApi('/api/categories', { method: 'POST', body: JSON.stringify(newCat) }, 'CREATE_STACK');
      if (res?.category) {
        setCategories((prev) => prev.map((c) => (c.id === newCat.id ? res.category : c)));
      }
    } else if (editingCategory && typeof editingCategory === 'object') {
      const updated = { ...editingCategory, ...data };
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      const res: any = await requestApi('/api/categories', { method: 'PUT', body: JSON.stringify(updated) }, 'UPDATE_STACK');
      if (res?.category) {
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? res.category : c)));
      }
    }
    setEditingCategory(null);
    triggerWorkspaceMutationSave();
  };

  const executeDeleteCategory = async (catId: string) => {
    const targetCat = categories.find((c) => c.id === catId);
    setDocuments((prev) => prev.filter((d) => d.categoryId !== catId));
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (activeDoc?.categoryId === catId) setActiveDoc(null);
    if (chatDoc?.categoryId === catId) setChatDoc(null);
    setEditingCategory(null);
    setConfirmModalState(null);

    const purgedPaths: string[] = [];
    if (targetCat?.title) purgedPaths.push(targetCat.title);

    try {
      const res: any = await requestApi(`/api/categories?id=${encodeURIComponent(catId)}`, { method: 'DELETE' }, 'DELETE_STACK');
      if (res?.purgedPaths) purgedPaths.push(...res.purgedPaths);
    } catch (err) {
      console.error('Failed to delete category on server:', err);
    }

    // Delete from local directory handle
    await purgeFromAllLocalHandles(purgedPaths);

    setWorkspaceToast(`[PURGED] COLUMN AND ITS DOCUMENTS REMOVED`);
    setTimeout(() => setWorkspaceToast(null), 3000);

    handleSaveAll();
  };

  const executeDeleteKanbanBoard = async (boardId: string) => {
    // Find all categories/columns belonging to this Kanban board
    const colsToDelete = categories.filter((c) => c.boardId === boardId || c.id === boardId);
    const colIds = colsToDelete.map((c) => c.id);

    // Purge all documents belonging to these columns
    setDocuments((prev) => prev.filter((d) => !colIds.includes(d.categoryId)));
    // Purge columns from categories state
    setCategories((prev) => prev.filter((c) => !colIds.includes(c.id)));

    // Purge board node & its edges from graph
    const targetGraphNode = nodes.find((n) => n.collectionId === boardId || n.id === boardId);
    setNodes((prev) => prev.filter((n) => n.collectionId !== boardId && n.id !== boardId));
    setEdges((prev) =>
      prev.filter((e) => {
        const sourceNode = nodes.find((n) => n.id === e.source);
        const targetNode = nodes.find((n) => n.id === e.target);
        return (
          sourceNode?.collectionId !== boardId &&
          sourceNode?.id !== boardId &&
          targetNode?.collectionId !== boardId &&
          targetNode?.id !== boardId
        );
      })
    );

    // If deleting the active board, reset active board to main or return to graph
    if (activeCollectionId === boardId) {
      setActiveCollectionId('kanban-main');
      setActiveCollectionTitle('CORE_KANBAN_BOARD');
    }

    if (activeDoc && colIds.includes(activeDoc.categoryId)) setActiveDoc(null);
    if (chatDoc && colIds.includes(chatDoc.categoryId)) setChatDoc(null);
    setConfirmModalState(null);

    const purgedPaths: string[] = [];
    if (targetGraphNode?.title) purgedPaths.push(targetGraphNode.title);
    for (const col of colsToDelete) {
      if (col.title) purgedPaths.push(col.title);
    }

    // Delete graph node on server
    if (targetGraphNode) {
      try {
        const res: any = await requestApi('/api/graph', {
          method: 'POST',
          body: JSON.stringify({ action: 'DELETE_NODE', id: targetGraphNode.id }),
        }, 'DELETE_GRAPH_NODE');
        if (res?.purgedPaths) purgedPaths.push(...res.purgedPaths);
      } catch (err) {
        console.error(err);
      }
    }

    // Delete categories from server
    for (const colId of colIds) {
      requestApi(`/api/categories?id=${encodeURIComponent(colId)}`, { method: 'DELETE' }, 'DELETE_STACK').catch((err) => {
        console.error('Failed to delete category on server:', err);
      });
    }

    // Delete from local directory handle
    await purgeFromAllLocalHandles(purgedPaths);

    setWorkspaceToast(`[PURGED] KANBAN BOARD & COLUMNS REMOVED`);
    setTimeout(() => setWorkspaceToast(null), 3000);

    handleSaveAll();
  };

  const requestDeleteCategory = (catId: string) => {
    const targetCat = categories.find((c) => c.id === catId);
    const docCount = documents.filter((d) => d.categoryId === catId).length;
    setConfirmModalState({
      isOpen: true,
      title: 'PURGE STACK COLUMN',
      itemName: targetCat?.title || 'COLUMN',
      itemType: 'stack',
      documentCount: docCount,
      warningText: `Deleting this column will permanently purge all ${docCount} enclosed document(s) from disk storage.`,
      onConfirm: () => executeDeleteCategory(catId),
    });
  };

  const handleCollapseTags = (oldTags: string[], newTag: string) => {
    if (!oldTags || oldTags.length === 0 || !newTag.trim()) return;

    const oldSet = new Set(oldTags.map((t) => t.trim().toUpperCase()));
    const replacement = newTag.trim().toUpperCase().replace(/[^A-Za-z0-9_-]/g, '');
    if (!replacement) return;

    // 1. Update Documents
    setDocuments((prev) =>
      prev.map((doc) => {
        const docTagsUpper = (doc.tags || []).map((t) => t.trim().toUpperCase());
        const hasMatch = docTagsUpper.some((t) => oldSet.has(t));
        if (!hasMatch) return doc;

        const newTags: string[] = [];
        for (const t of doc.tags || []) {
          const u = t.trim().toUpperCase();
          if (!oldSet.has(u)) {
            if (!newTags.some((existing) => existing.toUpperCase() === u)) {
              newTags.push(t);
            }
          }
        }
        if (!newTags.some((existing) => existing.toUpperCase() === replacement)) {
          newTags.push(replacement);
        }

        const updatedDoc = { ...doc, tags: newTags };
        if (activeDoc?.id === doc.id) setActiveDoc(updatedDoc);
        if (chatDoc?.id === doc.id) setChatDoc(updatedDoc);

        requestApi('/api/documents', {
          method: 'PUT',
          body: JSON.stringify(updatedDoc),
        }, 'UPDATE_DOC_TAGS').catch(() => {});

        return updatedDoc;
      })
    );

    // 2. Update Categories / Stacks
    setCategories((prev) =>
      prev.map((cat) => {
        const catTagsUpper = (cat.tags || []).map((t) => t.trim().toUpperCase());
        const hasMatch = catTagsUpper.some((t) => oldSet.has(t));
        if (!hasMatch) return cat;

        const newTags: string[] = [];
        for (const t of cat.tags || []) {
          const u = t.trim().toUpperCase();
          if (!oldSet.has(u)) {
            if (!newTags.some((existing) => existing.toUpperCase() === u)) {
              newTags.push(t);
            }
          }
        }
        if (!newTags.some((existing) => existing.toUpperCase() === replacement)) {
          newTags.push(replacement);
        }

        const updatedCat = { ...cat, tags: newTags };

        requestApi('/api/categories', {
          method: 'PUT',
          body: JSON.stringify(updatedCat),
        }, 'UPDATE_STACK_TAGS').catch(() => {});

        return updatedCat;
      })
    );

    // 3. Update Topology Graph Nodes (Folders, Stacks/Kanban, Sticky Notes)
    setNodes((prev) =>
      prev.map((node) => {
        const nodeTagsUpper = (node.tags || []).map((t) => t.trim().toUpperCase());
        const hasMatch = nodeTagsUpper.some((t) => oldSet.has(t));
        if (!hasMatch) return node;

        const newTags: string[] = [];
        for (const t of node.tags || []) {
          const u = t.trim().toUpperCase();
          if (!oldSet.has(u)) {
            if (!newTags.some((existing) => existing.toUpperCase() === u)) {
              newTags.push(t);
            }
          }
        }
        if (!newTags.some((existing) => existing.toUpperCase() === replacement)) {
          newTags.push(replacement);
        }

        const updatedNode = { ...node, tags: newTags };
        if (editingNode?.id === node.id) setEditingNode(updatedNode);

        requestApi('/api/graph', {
          method: 'POST',
          body: JSON.stringify({ action: 'UPDATE_NODE', node: updatedNode }),
        }, 'UPDATE_NODE_TAGS').catch(() => {});

        return updatedNode;
      })
    );

    setWorkspaceToast(
      `[TAGS COLLAPSED] '${oldTags.join(', ')}' ➔ '${replacement}' REPLACED ACROSS ALL ASSETS`
    );
    setTimeout(() => setWorkspaceToast(null), 3500);
    triggerWorkspaceMutationSave();
  };

  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags)));

  // Categories belonging to the active Kanban Board
  const activeBoardCategories = categories.filter((c) =>
    c.boardId ? c.boardId === activeCollectionId : (activeCollectionId === 'kanban-main' || activeCollectionId === 'cat-inbox')
  );
  const activeBoardCategoryIds = activeBoardCategories.map((c) => c.id);

  const filteredDocs = documents.filter((d) => {
    const inActiveBoard = activeBoardCategoryIds.includes(d.categoryId);
    if (!inActiveBoard) return false;
    const matchesSearch =
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || d.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121214] text-[#F3EDE0] font-mono text-sm font-black select-none">
        <div className="flex flex-col items-center gap-3 p-6 border-2 border-black bg-[#1E1E24] shadow-[4px_4px_0px_#000000]">
          <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent animate-spin" />
          <div className="tracking-wider uppercase">INITIALIZING DOCUSTACK VAULT KERNEL...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col p-4 select-none overflow-x-hidden font-mono antialiased">
      <BiomeCanvas
        biome={biome}
        theme={theme}
        motionEnabled={motionEnabled}
        appWallpaper={appWallpaper}
        overlayColor={themeConfig.overlayColor}
        overlayOpacity={themeConfig.overlayOpacity}
      />

      <Header
        theme={theme}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          requestApi('/api/biome', { method: 'POST', body: JSON.stringify({ theme: next }) }, 'SET_THEME');
        }}
        biome={biome}
        onChangeBiome={(b) => {
          setBiome(b);
          requestApi('/api/biome', { method: 'POST', body: JSON.stringify({ biome: b }) }, 'SET_BIOME');
        }}
        motionEnabled={motionEnabled}
        onToggleMotion={() => setMotionEnabled(!motionEnabled)}
        onOpenCreateCategory={() => setEditingCategory('NEW')}
        onUploadClick={() => fileInputRef.current?.click()}
        onToggleMonitor={() => setIsMonitorOpen(!isMonitorOpen)}
        isMonitorOpen={isMonitorOpen}
        docCount={documents.length}
        catCount={categories.length}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          transitionToViewMode(mode);
          setDraggedCardId(null);
        }}
        workspaceName={currentUser?.workspaceName || nodes.find((n) => n.isWorkspaceRoot)?.title || 'DOCUSTACK_VAULT'}
        currentCollectionTitle={activeCollectionTitle}
        onReturnToGraph={() => {
          transitionToViewMode('graph');
          setDraggedCardId(null);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVaultExplorer={() => setIsVaultExplorerOpen(true)}
        onOpenWorkspaceFolderSelector={() => setIsWorkspaceFolderSelectorOpen(true)}
        onOpenWorkspacesTilesMenu={() => setIsWorkspacesMenuOpen(true)}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenMediaVault={() => setIsMediaVaultOpen(true)}
        onOpenAdminPanel={() => router.push('/admin')}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={handleToggleAutoSave}
        autoSaveClonesEnabled={autoSaveClonesEnabled}
        onToggleAutoSaveClones={handleToggleAutoSaveClones}
        cloneCount={cloneCount}
        saveStatus={saveStatus}
        onManualSave={handleSaveAll}
      />

      {/* Workspace Toast Notification - Small, discreet, and unobtrusive */}
      {workspaceToast && (
        <div className="fixed bottom-5 right-5 z-40 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-700/80 bg-neutral-900/90 text-neutral-200 shadow-md backdrop-blur-sm font-mono text-[11px] font-medium tracking-tight animate-in fade-in duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span>{workspaceToast}</span>
        </div>
      )}

      {/* Local Storage Machine Disablement Notice Banner - Auto-dismisses in 6-7s */}
      {localFsDeviceError && (
        <div className="fixed top-14 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 border border-red-500/80 bg-neutral-950/95 text-red-200 p-2.5 rounded-md shadow-xl backdrop-blur-md font-mono text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-sm">⚠️</span>
            <span className="leading-snug text-[11px] break-words">{localFsDeviceError}</span>
          </div>
          <button
            onClick={() => setLocalFsDeviceError(null)}
            className="text-neutral-400 hover:text-white font-bold text-xs px-1.5 py-0.5 border border-neutral-700 hover:border-neutral-500 rounded transition-colors shrink-0"
            title="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      <WorkspaceViewRouter
        viewMode={viewMode}
        theme={theme}
        motionEnabled={motionEnabled}
        onToggleMotion={() => setMotionEnabled(!motionEnabled)}
        nodes={nodes}
        edges={edges}
        groups={groups}
        categories={categories}
        documents={documents}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        focusTarget={focusTarget}
        appWallpaper={appWallpaper}
        canvasWallpaperInputRef={canvasWallpaperInputRef}
        handleRemoveCanvasWallpaper={handleDeleteCanvasWallpaperFile}
        handleUploadCanvasWallpaperFile={handleUploadCanvasWallpaperFile}
        setActiveCollectionId={setActiveCollectionId}
        setActiveCollectionTitle={setActiveCollectionTitle}
        transitionToViewMode={transitionToViewMode}
        handleAddGraphNode={handleAddGraphNode}
        handleUpdateGraphNode={handleUpdateGraphNode}
        requestDeleteGraphNode={requestDeleteGraphNode}
        executeDeleteMultipleGraphNodes={executeDeleteMultipleGraphNodes}
        setEditingNode={setEditingNode}
        handleSaveGroups={handleSaveGroups}
        handleOpenWorkspaceFolder={handleOpenWorkspaceFolder}
        activeCollectionId={activeCollectionId}
        activeBoardCategories={activeBoardCategories}
        filteredDocs={filteredDocs}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        allTags={allTags}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        dragOverCategoryId={dragOverCategoryId}
        setDragOverCategoryId={setDragOverCategoryId}
        setEditingCategory={setEditingCategory}
        handleDeleteDoc={handleDeleteDoc}
        handleQuickNlpAnalyze={handleQuickNlpAnalyze}
        setContextMenuState={setContextMenuState}
        setDraggedCardId={setDraggedCardId}
        handleFileUpload={handleFileUpload}
        requestDeleteCategory={requestDeleteCategory}
        handleAddStackToWorkspace={handleAddStackToWorkspace}
        handleSetCategoryWallpaperFile={handleSetCategoryWallpaperFile}
        triggerWorkspaceMutationSave={triggerWorkspaceMutationSave}
        setDocuments={setDocuments}
        setActiveDoc={setActiveDoc}
        setActiveDocSearchQuery={setActiveDocSearchQuery}
        handleUpdateDoc={handleUpdateDoc}
        handleUpdateWorkspaces={handleUpdateWorkspaces}
        handleSelectWorkspaceId={handleSelectWorkspaceId}
        handleAddDocFromWeb={handleAddDocFromWeb}
        handleCollapseTags={handleCollapseTags}
        setFocusTarget={setFocusTarget}
      />

      <WorkspaceModalsContainer
        theme={theme}
        themeConfig={themeConfig}
        savedThemes={savedThemes}
        motionEnabled={motionEnabled}
        appWallpaper={appWallpaper}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          requestApi('/api/biome', { method: 'POST', body: JSON.stringify({ theme: next }) }, 'SET_THEME');
        }}
        onChangeThemeConfig={handleChangeThemeConfig}
        onSaveCustomTheme={handleSaveCustomTheme}
        onDeleteCustomTheme={handleDeleteCustomTheme}
        onToggleMotion={() => setMotionEnabled(!motionEnabled)}
        onChangeWallpaper={handleChangeWallpaper}
        currentUser={currentUser}
        userToken={userToken}
        isLoginOpen={isLoginOpen}
        setIsLoginOpen={setIsLoginOpen}
        isAdminPanelOpen={isAdminPanelOpen}
        setIsAdminPanelOpen={setIsAdminPanelOpen}
        isMediaVaultOpen={isMediaVaultOpen}
        setIsMediaVaultOpen={setIsMediaVaultOpen}
        isWorkspaceFolderSelectorOpen={isWorkspaceFolderSelectorOpen}
        setIsWorkspaceFolderSelectorOpen={setIsWorkspaceFolderSelectorOpen}
        isWorkspacesMenuOpen={isWorkspacesMenuOpen}
        setIsWorkspacesMenuOpen={setIsWorkspacesMenuOpen}
        handleLoginSuccess={handleLoginSuccess}
        handleLogout={handleLogout}
        handleEnterWorkspace={handleEnterWorkspace}
        loadUserWorkspaceData={loadUserWorkspaceData}
        setCurrentUser={setCurrentUser}
        contextMenuState={contextMenuState}
        setContextMenuState={setContextMenuState}
        activeDoc={activeDoc}
        setActiveDoc={setActiveDoc}
        activeDocSearchQuery={activeDocSearchQuery}
        setActiveDocSearchQuery={setActiveDocSearchQuery}
        chatDoc={chatDoc}
        setChatDoc={setChatDoc}
        handleAddToWorkSpace={handleAddToWorkSpace}
        handleQuickNlpAnalyze={handleQuickNlpAnalyze}
        handleDeleteDoc={handleDeleteDoc}
        handleUpdateDoc={handleUpdateDoc}
        handleChatSend={handleChatSend}
        isAnalyzing={isAnalyzing}
        categories={categories}
        nodes={nodes}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        handleSaveCategory={handleSaveCategory}
        requestDeleteCategory={requestDeleteCategory}
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        handleUpdateGraphNode={handleUpdateGraphNode}
        handleOpenWorkspaceFolder={handleOpenWorkspaceFolder}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isVaultExplorerOpen={isVaultExplorerOpen}
        setIsVaultExplorerOpen={setIsVaultExplorerOpen}
        refreshDocuments={refreshDocuments}
        handleAssetPurged={handleAssetPurged}
        draggedCardId={draggedCardId}
        setDraggedCardId={setDraggedCardId}
        viewMode={viewMode}
        isMonitorOpen={isMonitorOpen}
        setIsMonitorOpen={setIsMonitorOpen}
        confirmModalState={confirmModalState}
        setConfirmModalState={setConfirmModalState}
        docToAddToWorkspace={docToAddToWorkspace}
        setDocToAddToWorkspace={setDocToAddToWorkspace}
        workspaces={workspaces}
        handleConfirmAddToWorkspace={handleConfirmAddToWorkspace}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        transitionKey={transitionKey}
        setTransitionKey={setTransitionKey}
        transitionTargetMode={transitionTargetMode}
        setTransitionTargetMode={setTransitionTargetMode}
        setViewMode={setViewMode}
      />
    </main>
  );
}

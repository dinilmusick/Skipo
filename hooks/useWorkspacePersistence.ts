import { useState, useCallback, useEffect, useRef } from 'react';
import { GraphNode, GraphEdge, GraphGroup, DocCategory, DocumentItem, UserAccount, UserStorageConnection } from '../lib/types';
import { requestApi } from '../lib/api-client';
import { getLocalDirectoryHandle, syncWorkspaceToDirectoryHandle, getActiveLocalDirectoryHandle } from '../lib/local-fs-handle';
import { formatCanonicalWorkspaceFolderName } from '../lib/workspace-canonical';

interface UseWorkspacePersistenceProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  categories: DocCategory[];
  documents: DocumentItem[];
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  activeWorkspaceId: string;
  cloneConnections: UserStorageConnection[];
  isLocalFsDisabledForSession: boolean;
  setWorkspaceToast: (msg: string | null) => void;
}

const formatProviderLabel = (p?: string): string => {
  if (!p) return 'Cloud';
  const clean = p.toLowerCase();
  if (clean === 'backblaze_b2') return 'Backblaze B2';
  if (clean === 'cloudflare_r2') return 'Cloudflare R2';
  if (clean === 'aws_s3') return 'AWS S3';
  if (clean === 'supabase_storage') return 'Supabase';
  if (clean === 'local_fs') return 'Local Storage';
  return p;
};

export function useWorkspacePersistence({
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
}: UseWorkspacePersistenceProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'dirty'>('idle');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docustack_auto_save');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const [autoSaveClonesEnabled, setAutoSaveClonesEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docustack_auto_save_clones');
      return stored !== null ? stored === 'true' : false;
    }
    return false;
  });

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelPendingSave = useCallback(() => {
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = null;
    }
  }, []);

  const handleSaveAll = useCallback(async (overrides?: {
    nodes?: GraphNode[];
    edges?: GraphEdge[];
    groups?: GraphGroup[];
    categories?: DocCategory[];
    documents?: DocumentItem[];
  }) => {
    const activeNodes = overrides?.nodes ?? nodesRef.current;
    const activeEdges = overrides?.edges ?? edgesRef.current;
    const activeGroups = overrides?.groups ?? groupsRef.current;
    const activeCategories = overrides?.categories ?? categoriesRef.current;
    const activeDocuments = overrides?.documents ?? documentsRef.current;

    setSaveStatus('saving');
    try {
      const res: any = await requestApi('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_all',
          nodes: activeNodes,
          edges: activeEdges,
          groups: activeGroups,
          categories: activeCategories,
          documents: activeDocuments,
        }),
      }, 'SAVE_ALL_WORKSPACE');

      let replicatedCloneCount = 0;
      // 1. If auto-save to clones is enabled and clone connections exist, replicate to cloud clones
      if (autoSaveClonesEnabled && cloneConnections.length > 0) {
        const cloudClones = cloneConnections.filter((c) => c.provider !== 'local_fs');
        if (cloudClones.length > 0) {
          try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('docustackAuthToken') : null;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const cloneRes = await fetch('/api/auth/storage/sync-clones', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                nodes: activeNodes,
                edges: activeEdges,
                groups: activeGroups,
                categories: activeCategories,
                documents: activeDocuments,
              }),
            });
            const cloneData = await cloneRes.json();
            if (cloneData.success) {
              replicatedCloneCount += (cloneData.successfulClones || []).length;
            }
          } catch (cloneErr) {
            console.warn('[AutoSave Clone Sync Warning]', cloneErr);
          }
        }
      }

      // 2. Replicate to local_fs handles (Primary, Workspace-specific, and Clones)
      if (!isLocalFsDisabledForSession) {
        const currentWs = currentUser?.workspaces?.find((w) => w.id === (activeWorkspaceId || currentUser.activeWorkspaceId));
        const uName = currentUser?.username || currentUser?.name || 'user';
        const subfolder =
          res?.folderPrefix ||
          currentWs?.workspacePath?.replace(/^\.\//, '') ||
          (currentWs?.name ? formatCanonicalWorkspaceFolderName('docustack', uName, currentWs.name) : '') ||
          currentUser?.workspacePath?.replace(/^\.\//, '') ||
          'workspace';

        const userConns: UserStorageConnection[] =
          currentUser?.appProfiles?.docustack?.storage_connections || (currentUser as any)?.storage_connections || [];
        const primaryConn = userConns.find(
          (c: UserStorageConnection) => c.role === 'primary' || (c as any).isPrimary || c.id === (currentUser as any)?.primaryStorageConnectionId
        );
        const localTargets: { key?: string; name?: string }[] = [];
        if (currentWs?.localFolderKey) {
          localTargets.push({ key: currentWs.localFolderKey, name: currentWs.localFolderName });
        }
        if (primaryConn?.provider === 'local_fs' && primaryConn.localFolderKey) {
          localTargets.push({ key: primaryConn.localFolderKey, name: primaryConn.localFolderName || primaryConn.label });
        }
        for (const c of userConns) {
          if (c.provider === 'local_fs' && c.localFolderKey) {
            localTargets.push({ key: c.localFolderKey, name: c.localFolderName || c.label });
          }
        }
        if (autoSaveClonesEnabled) {
          const localClones = cloneConnections.filter((c) => c.provider === 'local_fs' && c.localFolderKey);
          for (const lc of localClones) {
            localTargets.push({ key: lc.localFolderKey, name: lc.localFolderName || lc.label });
          }
        }

        const syncedKeys = new Set<string>();
        for (const target of localTargets) {
          if (!target.key || syncedKeys.has(target.key)) continue;
          syncedKeys.add(target.key);
          try {
            const handle = await getLocalDirectoryHandle(target.key);
            if (handle) {
              await syncWorkspaceToDirectoryHandle(
                handle,
                target.name || 'DocuStack',
                {
                  nodes: activeNodes,
                  edges: activeEdges,
                  groups: activeGroups,
                  categories: activeCategories,
                  documents: activeDocuments,
                  folderPrefix: subfolder,
                }
              );
              replicatedCloneCount++;
            }
          } catch (localErr) {
            console.warn('[AutoSave LocalFS Sync Warning]', localErr);
          }
        }

        const activeMemHandle = getActiveLocalDirectoryHandle();
        if (activeMemHandle && syncedKeys.size === 0) {
          try {
            await syncWorkspaceToDirectoryHandle(
              activeMemHandle,
              activeMemHandle.name || 'DocuStack',
              {
                nodes: activeNodes,
                edges: activeEdges,
                groups: activeGroups,
                categories: activeCategories,
                documents: activeDocuments,
                folderPrefix: subfolder,
              }
            );
            replicatedCloneCount++;
          } catch (memErr) {
            console.warn('[AutoSave Active Memory Handle Sync Warning]', memErr);
          }
        }
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      const provider = formatProviderLabel(res?.storageProvider || 'Storage');
      if (replicatedCloneCount > 0) {
        setWorkspaceToast(`Saved to ${provider} (+${replicatedCloneCount} backup)`);
      } else {
        setWorkspaceToast(`Saved to ${provider}`);
      }
      setTimeout(() => setWorkspaceToast(null), 2200);
    } catch (err: any) {
      setSaveStatus('dirty');
      setWorkspaceToast(`Save failed: ${err?.message || 'Failed to save workspace'}`);
      setTimeout(() => setWorkspaceToast(null), 3000);
    }
  }, [nodes, edges, groups, categories, documents, autoSaveClonesEnabled, cloneConnections, currentUser, activeWorkspaceId, isLocalFsDisabledForSession, setWorkspaceToast]);

  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('docustack_auto_save', String(next));
      }
      if (next) {
        setWorkspaceToast('Auto-save enabled');
        setTimeout(() => setWorkspaceToast(null), 2000);
        handleSaveAll();
      } else {
        setWorkspaceToast('Auto-save disabled (Cmd+S to save)');
        setTimeout(() => setWorkspaceToast(null), 2000);
      }
      return next;
    });
  }, [handleSaveAll, setWorkspaceToast]);

  const handleToggleAutoSaveClones = useCallback(() => {
    setAutoSaveClonesEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('docustack_auto_save_clones', String(next));
      }
      if (next) {
        setWorkspaceToast('Backup clone auto-sync enabled');
        setTimeout(() => setWorkspaceToast(null), 2000);
        handleSaveAll();
      } else {
        setWorkspaceToast('Backup clone auto-sync disabled');
        setTimeout(() => setWorkspaceToast(null), 2000);
      }
      return next;
    });
  }, [handleSaveAll, setWorkspaceToast]);

  // Global Keyboard Shortcut: Cmd+S / Ctrl+S to save workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveAll]);

  // Event-driven workspace save timer (solely triggered by explicit workspace mutation events)
  const triggerWorkspaceMutationSave = useCallback((immediate = false) => {
    if (!autoSaveEnabled) return;
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = null;
    }
    if (immediate) {
      handleSaveAll();
    } else {
      saveDebounceTimerRef.current = setTimeout(() => {
        handleSaveAll();
      }, 1500);
    }
  }, [autoSaveEnabled, handleSaveAll]);

  return {
    saveStatus,
    setSaveStatus,
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveClonesEnabled,
    setAutoSaveClonesEnabled,
    handleSaveAll,
    cancelPendingSave,
    handleToggleAutoSave,
    handleToggleAutoSaveClones,
    triggerWorkspaceMutationSave,
  };
}

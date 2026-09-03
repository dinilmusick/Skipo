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

  const handleSaveAll = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const res: any = await requestApi('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_all',
          nodes,
          edges,
          groups,
          categories,
          documents,
        }),
      }, 'SAVE_ALL_WORKSPACE');

      let replicatedCloneCount = 0;
      // If auto-save to clones is enabled and clone connections exist, replicate to all clones
      if (autoSaveClonesEnabled && cloneConnections.length > 0) {
        // 1. Replicate to cloud clones via sync-clones endpoint
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
                nodes,
                edges,
                groups,
                categories,
                documents,
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

        // 2. Replicate to local_fs handles (Primary, Workspace-specific, and Clones)
        if (!isLocalFsDisabledForSession) {
          const currentWs = currentUser?.workspaces?.find((w) => w.id === (currentUser.activeWorkspaceId || activeWorkspaceId));
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
                  { nodes, edges, groups, categories, documents, folderPrefix: subfolder }
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
                { nodes, edges, groups, categories, documents, folderPrefix: subfolder }
              );
            } catch (memErr) {
              console.warn('[AutoSave Active Memory Handle Sync Warning]', memErr);
            }
          }
        }
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      const provider = res?.storageProvider || 'Storage';
      if (replicatedCloneCount > 0) {
        setWorkspaceToast(`[SAVED & REPLICATED] VAULT SAVED TO ${provider.toUpperCase()} & ${replicatedCloneCount} BACKUP CLONE(S)`);
      } else {
        setWorkspaceToast(`[SAVED] WORKSPACE VAULT SAVED TO ${provider.toUpperCase()}`);
      }
      setTimeout(() => setWorkspaceToast(null), 3500);
    } catch (err: any) {
      setSaveStatus('dirty');
      setWorkspaceToast(`[SAVE ERROR] ${err?.message || 'Failed to save workspace'}`);
      setTimeout(() => setWorkspaceToast(null), 3500);
    }
  }, [nodes, edges, groups, categories, documents, autoSaveClonesEnabled, cloneConnections, currentUser, activeWorkspaceId, isLocalFsDisabledForSession, setWorkspaceToast]);

  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('docustack_auto_save', String(next));
      }
      if (next) {
        setWorkspaceToast('[AUTO-SAVE ENABLED] CHANGES SYNC AUTOMATICALLY');
        setTimeout(() => setWorkspaceToast(null), 3000);
        handleSaveAll();
      } else {
        setWorkspaceToast('[AUTO-SAVE DISABLED] PRESS CMD+S / CTRL+S TO SAVE');
        setTimeout(() => setWorkspaceToast(null), 3000);
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
        setWorkspaceToast('[CLONE AUTO-SAVE ENABLED] SAVING REPLICATES TO ALL BACKUP CLONES');
        setTimeout(() => setWorkspaceToast(null), 3000);
        handleSaveAll();
      } else {
        setWorkspaceToast('[CLONE AUTO-SAVE DISABLED] SAVING ONLY COMMITS TO PRIMARY STORAGE');
        setTimeout(() => setWorkspaceToast(null), 3000);
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
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    handleToggleAutoSave,
    handleToggleAutoSaveClones,
    triggerWorkspaceMutationSave,
  };
}

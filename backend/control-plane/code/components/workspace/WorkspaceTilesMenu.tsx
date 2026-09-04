'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Cloud,
  Globe,
  Radio,
  Flame,
  FolderPlus,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sliders,
  Shield,
  LogOut,
  Search,
  FolderOpen,
  Check,
  X,
  RefreshCw,
  Copy,
  Zap,
} from 'lucide-react';
import {
  UserAccount,
  UserWorkspaceRecord,
  DatabaseEngine,
  UserStorageProvider,
  UserStorageConnection,
} from '@/lib/types';
import { BrutalistButton, BrutalistCard, BrutalistInput, BrutalistTextarea } from '../BrutalistUi';
import { formatCanonicalWorkspaceFolderName } from '@/lib/workspace-canonical';
import StorageConnectDrawer from './StorageConnectDrawer';
import {
  getLocalDirectoryHandle,
  getActiveLocalDirectoryHandle,
  purgeWorkspaceFromLocalHandle,
  syncWorkspaceToDirectoryHandle,
} from '@/lib/local-fs-handle';

interface WorkspaceTilesMenuProps {
  currentUser: Omit<UserAccount, 'passwordHash'>;
  userToken?: string | null;
  onEnterWorkspace: (workspace: UserWorkspaceRecord) => void;
  onOpenSettings?: () => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  onUserUpdated?: (updatedUser: Omit<UserAccount, 'passwordHash'>) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export default function WorkspaceTilesMenu({
  currentUser,
  userToken,
  onEnterWorkspace,
  onOpenSettings,
  onLogout,
  onOpenAdminPanel,
  onUserUpdated,
  onClose,
  canClose = false,
}: WorkspaceTilesMenuProps) {
  const [workspaces, setWorkspaces] = useState<UserWorkspaceRecord[]>(currentUser.workspaces || []);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    currentUser.activeWorkspaceId || currentUser.workspaces?.[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Workspace Modal State
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDescription, setNewWsDescription] = useState('');
  const [newWsEngine, setNewWsEngine] = useState<DatabaseEngine>('local_fs');
  const [newWsStorageConnId, setNewWsStorageConnId] = useState<string>('');
  const [newWsStorageProvider, setNewWsStorageProvider] = useState<UserStorageProvider>('local_fs');
  const [newWsLocalFolderName, setNewWsLocalFolderName] = useState<string>('');
  const [newWsLocalFolderKey, setNewWsLocalFolderKey] = useState<string>('');

  // Edit Workspace Modal State
  const [editingWorkspace, setEditingWorkspace] = useState<UserWorkspaceRecord | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsDescription, setEditWsDescription] = useState('');
  const [editWsEngine, setEditWsEngine] = useState<DatabaseEngine>('local_fs');
  const [editWsStorageConnId, setEditWsStorageConnId] = useState<string>('');
  const [editWsStorageProvider, setEditWsStorageProvider] = useState<UserStorageProvider>('local_fs');
  const [editWsLocalFolderName, setEditWsLocalFolderName] = useState<string>('');
  const [editWsLocalFolderKey, setEditWsLocalFolderKey] = useState<string>('');

  // Copy Feedback State
  const [copiedFolderId, setCopiedFolderId] = useState<string | null>(null);

  const currentUserName =
    currentUser.username || currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'user');

  const getAuthHeaders = (contentType: boolean = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = 'application/json';
    const token = userToken || (typeof window !== 'undefined' ? localStorage.getItem('docustackAuthToken') : null);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const refreshWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/workspaces', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.workspaces)) {
        setWorkspaces(data.workspaces);
        if (data.activeWorkspaceId) {
          setActiveWorkspaceId(data.activeWorkspaceId);
        } else if (data.workspaces.length === 0) {
          setActiveWorkspaceId('');
        }
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
      }
    } catch (err: any) {
      console.warn('Failed to refresh workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  useEffect(() => {
    if (currentUser.workspaces) {
      setWorkspaces(currentUser.workspaces);
      if (currentUser.activeWorkspaceId) {
        setActiveWorkspaceId(currentUser.activeWorkspaceId);
      } else if (currentUser.workspaces.length === 0) {
        setActiveWorkspaceId('');
      }
    }
  }, [currentUser]);

  // Enter Workspace Action
  const handleSelectAndEnter = async (ws: UserWorkspaceRecord) => {
    setLoading(true);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('docustack_active_workspace_id', ws.id);
      localStorage.setItem('docustack_workspace_path', ws.workspacePath);
      localStorage.setItem('docustack_workspace_name', ws.name);
    }
    try {
      const res = await fetch('/api/auth/workspaces', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          action: 'switch',
          workspaceId: ws.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveWorkspaceId(ws.id);
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
      }
      onEnterWorkspace(ws);
    } catch (err: any) {
      setError(err.message || 'Failed to switch workspace');
      onEnterWorkspace(ws);
    } finally {
      setLoading(false);
    }
  };

  // Create Workspace Action
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      setError('Please provide a Workspace Name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/workspaces', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          name: newWsName.trim(),
          description: newWsDescription.trim(),
          engine: newWsEngine,
          storageConnectionId: newWsStorageConnId || undefined,
          storageProvider: newWsStorageProvider || undefined,
          localFolderName: newWsLocalFolderName || undefined,
          localFolderKey: newWsLocalFolderKey || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create workspace');

      if (data.workspace) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('docustack_active_workspace_id', data.workspace.id);
          localStorage.setItem('docustack_workspace_path', data.workspace.workspacePath);
          localStorage.setItem('docustack_workspace_name', data.workspace.name);
        }
        setWorkspaces((prev) => [...prev, data.workspace]);
        setActiveWorkspaceId(data.workspace.id);
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }

        // Initialize local directory handle immediately if configured
        if (data.workspace.localFolderKey) {
          try {
            const handle = await getLocalDirectoryHandle(data.workspace.localFolderKey);
            if (handle) {
              const prefix = data.workspace.workspacePath ? data.workspace.workspacePath.replace(/^\.\//, '') : '';
              await syncWorkspaceToDirectoryHandle(handle, data.workspace.localFolderName || 'DocuStack', {
                nodes: [],
                edges: [],
                groups: [],
                categories: [],
                documents: [],
                folderPrefix: prefix,
              });
            }
          } catch {}
        }

        setIsCreatingWorkspace(false);
        setNewWsName('');
        setNewWsDescription('');
        setNewWsStorageConnId('');
        setNewWsLocalFolderName('');
        setNewWsLocalFolderKey('');
        setNewWsStorageProvider('local_fs');
        onEnterWorkspace(data.workspace);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  // Update Workspace Action
  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;
    if (!editWsName.trim()) {
      setError('Please provide a Workspace Name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/workspaces', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          workspaceId: editingWorkspace.id,
          updates: {
            name: editWsName.trim(),
            description: editWsDescription.trim(),
            engine: editWsEngine,
            storageConnectionId: editWsStorageConnId || undefined,
            storageProvider: editWsStorageProvider || undefined,
            localFolderName: editWsLocalFolderName || undefined,
            localFolderKey: editWsLocalFolderKey || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update workspace');

      if (data.workspace) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === editingWorkspace.id ? data.workspace : w))
        );
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
        setEditingWorkspace(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace');
    } finally {
      setLoading(false);
    }
  };

  // Delete Workspace Action
  const handleDeleteWorkspace = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workspace registration? This will permanently wipe its assets from all linked local and cloud storages.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const targetWs = workspaces.find((w) => w.id === workspaceId);
      const wsName = targetWs?.name || '';
      const rawWsPath = targetWs?.workspacePath ? targetWs.workspacePath.replace(/^\.\//, '') : '';

      // 1. Gather all candidate folder names used by this workspace
      const candidateFolderNames = Array.from(
        new Set(
          [
            rawWsPath,
            wsName ? formatCanonicalWorkspaceFolderName('docustack', currentUserName, wsName) : '',
            wsName ? formatCanonicalWorkspaceFolderName('DocuStack', currentUserName, wsName) : '',
            wsName ? `ultrst_docustack_${currentUserName}_${wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}` : '',
            `ultrst_docustack_${currentUserName}_vault`,
            `ultrst_docustack_${currentUserName}_docustack_vault`,
            `docustack_vault`,
            `vault`,
            wsName ? wsName.toLowerCase().replace(/[^a-z0-9_.-]/g, '_') : '',
            wsName,
          ].filter(Boolean) as string[]
        )
      );

      // 2. Client-side browser purge: Expunge workspace folder from local File System Directory handles
      const userConns: UserStorageConnection[] = [
        ...(currentUser.storage_connections || []),
        ...(currentUser.appProfiles?.docustack?.storage_connections || []),
      ];
      const localConns = userConns.filter((c) => c.provider === 'local_fs');
      const handleKeysToPurge = Array.from(
        new Set([
          targetWs?.localFolderKey,
          ...localConns.map((c) => c.localFolderKey),
        ].filter(Boolean) as string[])
      );

      for (const key of handleKeysToPurge) {
        try {
          const handle = await getLocalDirectoryHandle(key);
          if (handle) {
            await purgeWorkspaceFromLocalHandle(handle, candidateFolderNames);
          }
        } catch (localErr) {
          console.warn('[WorkspaceTilesMenu] Error purging local folder handle:', localErr);
        }
      }

      try {
        const activeHandle = getActiveLocalDirectoryHandle();
        if (activeHandle) {
          await purgeWorkspaceFromLocalHandle(activeHandle, candidateFolderNames);
        }
      } catch {}

      // 3. Server-side cloud purge: Send DELETE with full candidate prefixes and user storage connections
      const res = await fetch(`/api/auth/workspaces?workspaceId=${workspaceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          workspaceId,
          workspaceName: wsName,
          workspacePath: rawWsPath,
          candidatePrefixes: candidateFolderNames,
          storageConnections: userConns,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete workspace');

      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      if (activeWorkspaceId === workspaceId) {
        const remaining = workspaces.filter((w) => w.id !== workspaceId);
        const nextWs = remaining[0];
        setActiveWorkspaceId(nextWs?.id || '');
        if (nextWs) {
          onEnterWorkspace(nextWs);
        }
      }
      if (data.user && onUserUpdated) {
        onUserUpdated(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkspaces = workspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStorageIcon = (ws: UserWorkspaceRecord) => {
    if (ws.storageProvider === 'backblaze_b2' || ws.storageProvider === 'cloudflare_r2' || ws.storageProvider === 'aws_s3' || ws.storageProvider === 'supabase_storage') {
      return Zap;
    }
    return HardDrive;
  };

  const getStorageBadge = (ws: UserWorkspaceRecord) => {
    if (ws.storageProvider === 'backblaze_b2') return 'BACKBLAZE B2';
    if (ws.storageProvider === 'cloudflare_r2') return 'CLOUDFLARE R2';
    if (ws.storageProvider === 'aws_s3') return 'AWS S3';
    if (ws.storageProvider === 'supabase_storage') return 'SUPABASE';
    if (ws.localFolderName) return `LOCAL · ${ws.localFolderName.slice(0, 15)}`;
    if (ws.engine === 's3_blob') return 'S3 CLOUD';
    return 'LOCAL DISK';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto font-mono">
      <div className="w-full max-w-5xl my-8">
        {/* Top Control Bar Card */}
        <BrutalistCard variant="base" depth="lg" className="p-4 mb-4 border-2 border-brutalist shadow-[6px_6px_0px_var(--color-border)]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[var(--color-accent)] tracking-wider">
                  DOCUSTACK
                </span>
                <span className="text-xs font-black uppercase px-2 py-0.5 border border-brutalist bg-[var(--color-accent)] text-black">
                  WORKSPACES
                </span>
                {currentUser.role === 'admin' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 border border-purple-500 bg-purple-500/20 text-purple-300">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs opacity-75 mt-1 font-mono">
                User: <strong className="text-[var(--color-text)]">{currentUser.email}</strong> ({currentUserName}) · Active Profile: <strong className="text-[var(--color-accent)]">{workspaces.find((w) => w.id === activeWorkspaceId)?.name || 'None'}</strong>
              </p>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {canClose && onClose && (
                <BrutalistButton
                  variant="subtle"
                  onClick={onClose}
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5 border-brutalist"
                  title="Return to active canvas"
                >
                  <X size={14} />
                  <span>CLOSE</span>
                </BrutalistButton>
              )}

              {currentUser.role === 'admin' && onOpenAdminPanel && (
                <BrutalistButton
                  variant="subtle"
                  onClick={onOpenAdminPanel}
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5 border-purple-500 text-purple-400 hover:bg-purple-500/20"
                >
                  <Shield size={14} />
                  <span>ADMIN PANEL</span>
                </BrutalistButton>
              )}

              {onOpenSettings && (
                <BrutalistButton
                  variant="subtle"
                  onClick={onOpenSettings}
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Sliders size={14} />
                  <span>SETTINGS</span>
                </BrutalistButton>
              )}

              <BrutalistButton
                variant="subtle"
                onClick={refreshWorkspaces}
                disabled={loading}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Refresh Workspaces"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>SYNC</span>
              </BrutalistButton>

              <BrutalistButton
                variant="subtle"
                onClick={onLogout}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5 text-red-400 hover:bg-red-500/20 border-red-500/50"
              >
                <LogOut size={14} />
                <span>LOGOUT</span>
              </BrutalistButton>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="mt-4 pt-4 border-t-2 border-brutalist flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces by name or description..."
                className="w-full bg-[var(--color-surface)] border-2 border-brutalist pl-9 pr-3 py-1.5 text-xs text-[var(--color-text)] placeholder-opacity-50 focus:outline-none focus:border-[var(--color-accent)] shadow-[2px_2px_0px_var(--color-border)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <BrutalistButton
                variant="accent"
                onClick={() => setIsCreatingWorkspace(true)}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-[2px_2px_0px_var(--color-border)]"
              >
                <Plus size={14} strokeWidth={3} />
                <span>NEW WORKSPACE</span>
              </BrutalistButton>
            </div>
          </div>
        </BrutalistCard>

        {/* Error Alert Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border-2 border-red-500 text-red-500 font-mono text-xs flex items-center justify-between gap-2 shadow-[3px_3px_0px_var(--color-border)]">
            <span className="font-bold">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs underline cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Workspaces Tiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkspaces.map((ws) => {
            const StorageIcon = getStorageIcon(ws);
            const isActive = ws.id === activeWorkspaceId;

            return (
              <div
                key={ws.id}
                onClick={() => handleSelectAndEnter(ws)}
                className={`group relative flex flex-col justify-between border-2 p-4.5 transition-all cursor-pointer select-none font-mono ${
                  isActive
                    ? 'border-brutalist bg-[var(--color-surface)] shadow-[6px_6px_0px_var(--color-accent)] ring-2 ring-[var(--color-accent)]'
                    : 'border-brutalist bg-[var(--color-surface)] shadow-[4px_4px_0px_var(--color-border)] hover:shadow-[6px_6px_0px_var(--color-border)] hover:-translate-y-1'
                }`}
              >
                <div>
                  {/* Top Bar: Icon, Storage Badge & Actions */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-10 w-10 items-center justify-center border-2 border-brutalist ${
                          isActive
                            ? 'bg-[var(--color-accent)] text-black'
                            : 'bg-black/10 text-[var(--color-accent)]'
                        } shadow-[2px_2px_0px_var(--color-border)]`}
                      >
                        <StorageIcon size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="inline-block font-mono text-[9px] font-black uppercase px-2 py-0.5 border border-brutalist bg-black/15 tracking-wider">
                          {getStorageBadge(ws)}
                        </span>
                        {isActive && (
                          <span className="ml-1 font-mono text-[9px] font-black uppercase text-[var(--color-accent)]">
                            ★ ACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Secondary Actions (Edit & Delete) */}
                    <div
                      className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWorkspace(ws);
                          setEditWsName(ws.name);
                          setEditWsDescription(ws.description || '');
                          setEditWsEngine(ws.engine);
                          setEditWsStorageConnId(ws.storageConnectionId || '');
                          setEditWsStorageProvider(ws.storageProvider || 'local_fs');
                          setEditWsLocalFolderName(ws.localFolderName || '');
                          setEditWsLocalFolderKey(ws.localFolderKey || '');
                        }}
                        className="p-1 border border-brutalist bg-[var(--color-surface-subtle)] hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer"
                        title="Edit Workspace"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                        className="p-1 border border-brutalist bg-[var(--color-surface-subtle)] hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                        title="Delete Workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Workspace Title & Raw Folder Pill */}
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-[var(--color-text)] line-clamp-1">
                      {ws.name}
                    </h3>
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          const rawName = (ws.workspacePath || '').replace(/^\.\//, '') || formatCanonicalWorkspaceFolderName('docustack', currentUserName, ws.name);
                          navigator.clipboard?.writeText(rawName);
                          setCopiedFolderId(ws.id);
                          setTimeout(() => setCopiedFolderId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-brutalist/40 bg-black/20 hover:bg-black/35 hover:border-[var(--color-accent)] text-[10px] font-mono text-[var(--color-accent)] transition-all cursor-pointer rounded-xs"
                        title="Click to copy raw folder name"
                      >
                        <FolderOpen size={11} className="shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {(ws.workspacePath || '').replace(/^\.\//, '') || formatCanonicalWorkspaceFolderName('docustack', currentUserName, ws.name)}
                        </span>
                        {copiedFolderId === ws.id ? (
                          <span className="text-[8px] bg-emerald-400 text-black px-1 font-bold ml-0.5">COPIED</span>
                        ) : (
                          <Copy size={10} className="opacity-60 hover:opacity-100 shrink-0 ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Description with mixed-case display */}
                  <p className="text-xs opacity-75 mt-2 line-clamp-2 leading-relaxed">
                    {ws.description || 'Workspace storage repository managed on user profile.'}
                  </p>
                </div>

                {/* Bottom Enter Workspace CTA Button */}
                <div className="mt-4 pt-3 border-t-2 border-brutalist flex items-center justify-between">
                  <span className="text-[10px] opacity-60 uppercase font-bold">
                    ID: {ws.id.slice(0, 10)}...
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAndEnter(ws);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition-all cursor-pointer border-2 border-brutalist shadow-[2px_2px_0px_var(--color-border)] ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-black hover:bg-[#c5a059]'
                        : 'bg-[var(--color-surface-subtle)] text-[var(--color-text)] hover:bg-[var(--color-accent)] hover:text-white'
                    }`}
                  >
                    <span>ENTER WORKSPACE</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Empty Workspaces / No Storage Connected Banner */}
          {workspaces.length === 0 && (
            <div className="col-span-full p-8 border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-surface)] text-center font-mono space-y-4 shadow-[6px_6px_0px_var(--color-border)]">
              <div className="inline-flex p-4 border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-[3px_3px_0px_var(--color-border)]">
                <HardDrive size={32} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase text-[var(--color-text)] tracking-wider">
                  NO STORAGE CONNECTED FOR WORKSPACE
                </h3>
                <p className="text-xs opacity-75 max-w-lg mx-auto mt-2 leading-relaxed">
                  You haven't connected a storage location for your workspace yet. Please connect a storage provider (such as a <strong>Local Folder</strong>, <strong>Backblaze B2</strong>, <strong>Cloudflare R2</strong>, <strong>Supabase</strong>, or <strong>AWS S3</strong>) to start storing and organizing your documents.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <BrutalistButton
                  variant="accent"
                  onClick={() => setIsCreatingWorkspace(true)}
                  className="px-6 py-2.5 text-xs font-black uppercase flex items-center gap-2 shadow-[3px_3px_0px_var(--color-border)]"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span>CONNECT STORAGE WORKSPACE NOW</span>
                </BrutalistButton>
              </div>
            </div>
          )}

          {/* Add New Workspace Card */}
          {workspaces.length > 0 && (
            <div
              onClick={() => setIsCreatingWorkspace(true)}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-brutalist bg-black/5 hover:bg-black/10 transition-all cursor-pointer shadow-[3px_3px_0px_var(--color-border)] min-h-[220px] text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center border-2 border-brutalist bg-[var(--color-accent)] text-black rounded-full shadow-[2px_2px_0px_var(--color-border)] mb-3">
                <FolderPlus size={22} strokeWidth={2.5} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text)]">
                ADD NEW WORKSPACE
              </h4>
              <p className="text-[11px] opacity-70 mt-1 max-w-[200px]">
                Provision a new workspace record with user-connected storage inside your account.
              </p>
            </div>
          )}
        </div>

        {/* Create Workspace Modal */}
        {isCreatingWorkspace && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto">
            <BrutalistCard
              variant="surface"
              depth="lg"
              className="w-full max-w-2xl p-6 border-2 border-brutalist shadow-[6px_6px_0px_var(--color-border)] font-mono animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-brutalist mb-4">
                <div className="flex items-center gap-2">
                  <FolderPlus size={18} className="text-[var(--color-accent)]" />
                  <h3 className="text-sm font-black uppercase text-[var(--color-text)]">
                    CREATE NEW WORKSPACE
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingWorkspace(false)}
                  className="p-1 border border-brutalist hover:bg-red-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-[var(--color-text)]">
                    Workspace Name *
                  </label>
                  <BrutalistInput
                    type="text"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="e.g. Research Vault, Projects Alpha"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-[var(--color-text)]">
                    Description
                  </label>
                  <BrutalistTextarea
                    rows={2}
                    value={newWsDescription}
                    onChange={(e) => setNewWsDescription(e.target.value)}
                    placeholder="Brief summary of this workspace purpose (upper and lower case supported)"
                  />
                </div>

                {/* Storage Connect Drawer */}
                <StorageConnectDrawer
                  userToken={userToken}
                  currentProvider={newWsStorageProvider}
                  currentConnectionId={newWsStorageConnId}
                  currentLocalFolderName={newWsLocalFolderName}
                  currentLocalFolderKey={newWsLocalFolderKey}
                  onSelectEngine={(eng) => setNewWsEngine(eng)}
                  onSelectLocalFolder={(name, key) => {
                    setNewWsLocalFolderName(name);
                    setNewWsLocalFolderKey(key);
                    setNewWsStorageProvider('local_fs');
                    setNewWsEngine('local_fs');
                  }}
                  onSelectCloudConnection={(conn) => {
                    setNewWsStorageConnId(conn.id);
                    setNewWsStorageProvider(conn.provider);
                    setNewWsEngine('s3_blob');
                  }}
                  onUserUpdated={onUserUpdated}
                />

                <div className="p-2.5 border border-brutalist/50 bg-black/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[var(--color-accent)]">
                      VAULT CANONICAL FOLDER LOCATION
                    </span>
                    <span className="text-[9px] opacity-60 uppercase font-mono">ECOSYSTEM STANDARD</span>
                  </div>
                  <code className="text-xs font-mono font-bold block text-emerald-400 truncate">
                    {formatCanonicalWorkspaceFolderName('docustack', currentUserName, newWsName || 'workspace')}
                  </code>
                  <span className="text-[9px] opacity-60 block leading-tight">
                    Deterministic format: ultrst_docustack_{'{user_name}'}_{'{workspace_name}'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-brutalist">
                  <BrutalistButton
                    variant="subtle"
                    type="button"
                    onClick={() => setIsCreatingWorkspace(false)}
                  >
                    CANCEL
                  </BrutalistButton>
                  <BrutalistButton variant="accent" type="submit" disabled={loading}>
                    {loading ? 'CREATING...' : 'CREATE & ENTER WORKSPACE'}
                  </BrutalistButton>
                </div>
              </form>
            </BrutalistCard>
          </div>
        )}

        {/* Edit Workspace Modal */}
        {editingWorkspace && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto">
            <BrutalistCard
              variant="surface"
              depth="lg"
              className="w-full max-w-2xl p-6 border-2 border-brutalist shadow-[6px_6px_0px_var(--color-border)] font-mono animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-brutalist mb-4">
                <div className="flex items-center gap-2">
                  <Edit3 size={18} className="text-[var(--color-accent)]" />
                  <h3 className="text-sm font-black uppercase text-[var(--color-text)]">
                    EDIT WORKSPACE SETTINGS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="p-1 border border-brutalist hover:bg-red-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-[var(--color-text)]">
                    Workspace Name *
                  </label>
                  <BrutalistInput
                    type="text"
                    value={editWsName}
                    onChange={(e) => setEditWsName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-[var(--color-text)]">
                    Description
                  </label>
                  <BrutalistTextarea
                    rows={2}
                    value={editWsDescription}
                    onChange={(e) => setEditWsDescription(e.target.value)}
                  />
                </div>

                {/* Storage Connect Drawer */}
                <StorageConnectDrawer
                  userToken={userToken}
                  currentProvider={editWsStorageProvider}
                  currentConnectionId={editWsStorageConnId}
                  currentLocalFolderName={editWsLocalFolderName}
                  currentLocalFolderKey={editWsLocalFolderKey}
                  onSelectEngine={(eng) => setEditWsEngine(eng)}
                  onSelectLocalFolder={(name, key) => {
                    setEditWsLocalFolderName(name);
                    setEditWsLocalFolderKey(key);
                    setEditWsStorageProvider('local_fs');
                    setEditWsEngine('local_fs');
                  }}
                  onSelectCloudConnection={(conn) => {
                    setEditWsStorageConnId(conn.id);
                    setEditWsStorageProvider(conn.provider);
                    setEditWsEngine('s3_blob');
                  }}
                  onUserUpdated={onUserUpdated}
                />

                <div className="p-2.5 border border-brutalist/50 bg-black/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[var(--color-accent)]">
                      VAULT CANONICAL FOLDER LOCATION
                    </span>
                    <span className="text-[9px] opacity-60 uppercase font-mono">ECOSYSTEM STANDARD</span>
                  </div>
                  <code className="text-xs font-mono font-bold block text-emerald-400 truncate">
                    {formatCanonicalWorkspaceFolderName('docustack', currentUserName, editWsName || editingWorkspace.name)}
                  </code>
                  <span className="text-[9px] opacity-60 block leading-tight">
                    Deterministic format: ultrst_docustack_{'{user_name}'}_{'{workspace_name}'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-brutalist">
                  <BrutalistButton
                    variant="subtle"
                    type="button"
                    onClick={() => setEditingWorkspace(null)}
                  >
                    CANCEL
                  </BrutalistButton>
                  <BrutalistButton variant="accent" type="submit" disabled={loading}>
                    {loading ? 'SAVING...' : 'SAVE WORKSPACE SETTINGS'}
                  </BrutalistButton>
                </div>
              </form>
            </BrutalistCard>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  Plus,
  Save,
  Trash2,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  Terminal,
  Cloud,
  Layers,
  ArrowDownCircle,
} from 'lucide-react';
import { ThemeMode } from '../lib/types';
import Tooltip from './Tooltip';
import { requestApi } from '../lib/api-client';
import {
  getActiveLocalDirectoryHandle,
  listLocalDirectoryTree,
  readLocalFileFromHandle,
  writeLocalFileToHandle,
  removeEntryFromLocalHandle,
} from '../lib/local-fs-handle';

interface FileTreeNode {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  sizeBytes?: number;
  sizeFormatted?: string;
  modifiedAt?: string;
  children?: FileTreeNode[];
}

interface WorkspaceExplorerModalProps {
  theme: ThemeMode;
  onClose: () => void;
  currentUser?: any;
  onRefreshAppDocs?: () => void;
  onAssetPurged?: (payload: {
    type: 'file' | 'folder';
    path: string;
    purgedDocIds?: string[];
    purgedCategoryIds?: string[];
    purgedNodeIds?: string[];
  }) => void;
}

export default function WorkspaceExplorerModal({
  theme,
  onClose,
  currentUser,
  onRefreshAppDocs,
  onAssetPurged,
}: WorkspaceExplorerModalProps) {
  const [activeSource, setActiveSource] = useState<'primary_storage' | 'local_backup'>('primary_storage');
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [vaultPath, setVaultPath] = useState<string>('');
  const [isCloudPrimary, setIsCloudPrimary] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<string>('backblaze_b2');
  const [bucketName, setBucketName] = useState<string>('');
  const [canonicalPrefix, setCanonicalPrefix] = useState<string>('');
  const [stats, setStats] = useState<{ fileCount: number; folderCount: number }>({
    fileCount: 0,
    folderCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New file creation form state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newContent, setNewContent] = useState('');

  // Detect whether user has configured a local storage option / tile / handle
  const hasLocalStorageOption = useMemo(() => {
    if (getActiveLocalDirectoryHandle()) return true;
    const userConns: any[] = [
      ...(currentUser?.storage_connections || []),
      ...(currentUser?.appProfiles?.docustack?.storage_connections || []),
    ];
    if (userConns.some((c: any) => c.provider === 'local_fs')) return true;
    if (currentUser?.workspaces?.some((w: any) => w.localFolderKey)) return true;
    return false;
  }, [currentUser]);

  // Dynamically extract real directories from active workspace tree
  const availableFolders = useMemo(() => {
    const folders: string[] = [''];
    function collect(node: FileTreeNode) {
      if (node.isDirectory && node.relativePath) {
        folders.push(node.relativePath);
      }
      if (node.children) {
        for (const child of node.children) {
          if (child.isDirectory) collect(child);
        }
      }
    }
    if (tree) collect(tree);
    return Array.from(new Set(folders));
  }, [tree]);

  const isDark = theme === 'dark';
  const modalBg = isDark
    ? 'bg-[#121214] text-[#F3EDE0] border-black shadow-[10px_10px_0px_#000000]'
    : 'bg-[#E8DCC4] text-[#21140E] border-[#2C1810] shadow-[10px_10px_0px_#2C1810]';

  // Auto-dismiss status toast after 6 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const fetchWorkspaceTree = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const activeHandle = getActiveLocalDirectoryHandle();

      // If local backup is selected and browser has active local handle, list native disk tree
      if (activeSource === 'local_backup' && activeHandle) {
        const { tree: localTree, stats: localStats } = await listLocalDirectoryTree(
          activeHandle,
          canonicalPrefix || undefined
        );
        setTree(localTree as any);
        setVaultPath(`[Local Host Disk]: ${activeHandle.name}`);
        setStats(localStats);
        setIsCloudPrimary(false);
        setCloudProvider('local_fs');
        return;
      }

      // Otherwise fetch from API (Cloud storage or Server local storage)
      const queryParam = activeSource === 'local_backup' ? '?source=local' : '';
      const data: any = await requestApi(`/api/workspace${queryParam}`, undefined, 'FETCH_WORKSPACE_TREE');
      if (data && data.success) {
        setTree(data.tree);
        setVaultPath(data.vaultPath || '');
        setStats(data.stats || { fileCount: 0, folderCount: 0 });
        setIsCloudPrimary(Boolean(data.isCloudPrimary));
        if (data.storageProvider) setCloudProvider(data.storageProvider);
        if (data.bucketName) setBucketName(data.bucketName);
        if (data.folderPrefix) setCanonicalPrefix(data.folderPrefix);
      }
    } catch (err: any) {
      console.warn('Error fetching workspace tree:', err);
      setStatusMessage(`NOTICE: ${err.message || 'Could not load directory tree.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceTree();
  }, [activeSource]);

  const handleSelectFile = async (node: FileTreeNode) => {
    if (node.isDirectory) return;
    setSelectedFile(node);
    setIsCreatingNew(false);
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const activeHandle = getActiveLocalDirectoryHandle();
      if (activeSource === 'local_backup' && activeHandle) {
        const content = await readLocalFileFromHandle(activeHandle, node.relativePath);
        setFileContent(content);
      } else {
        const queryParam = activeSource === 'local_backup' ? '&source=local' : '';
        const data: any = await requestApi(
          `/api/workspace?file=${encodeURIComponent(node.relativePath)}${queryParam}`,
          undefined,
          'READ_WORKSPACE_FILE'
        );
        if (data && data.success && data.content !== undefined) {
          setFileContent(data.content);
        } else {
          setFileContent(`# ${node.name}\n\nPath: ${node.relativePath}\nSize: ${node.sizeFormatted || 'Unknown'}`);
        }
      }
    } catch (err: any) {
      console.error('Error reading file content:', err);
      setFileContent(`# ${node.name}\n\n[Content not readable or file empty]\nError: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFileContent = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const activeHandle = getActiveLocalDirectoryHandle();
      if (activeSource === 'local_backup' && activeHandle) {
        await writeLocalFileToHandle(activeHandle, selectedFile.relativePath, fileContent);
        setStatusMessage(`FILE SAVED DIRECTLY TO LOCAL DISK (${selectedFile.name})`);
        fetchWorkspaceTree();
        if (onRefreshAppDocs) onRefreshAppDocs();
      } else {
        const queryParam = activeSource === 'local_backup' ? '?source=local' : '';
        const data: any = await requestApi(
          `/api/workspace${queryParam}`,
          {
            method: 'POST',
            body: JSON.stringify({
              relativePath: selectedFile.relativePath,
              content: fileContent,
            }),
          },
          'SAVE_VAULT_FILE'
        );

        if (data && data.success) {
          setStatusMessage(
            `FILE SAVED TO ${isCloudPrimary && activeSource === 'primary_storage' ? cloudProvider.replace('_', ' ').toUpperCase() : 'LOCAL VAULT'} (${selectedFile.name})`
          );
          fetchWorkspaceTree();
          if (onRefreshAppDocs) onRefreshAppDocs();
        } else {
          setStatusMessage(`ERROR: ${data?.error || 'Failed to save file'}`);
        }
      }
    } catch (err: any) {
      setStatusMessage(`FAILED TO SAVE: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFile = async (node: FileTreeNode) => {
    if (!confirm(`Are you sure you want to permanently delete physical file "${node.name}"?`)) return;

    try {
      const activeHandle = getActiveLocalDirectoryHandle();
      if (activeSource === 'local_backup' && activeHandle) {
        await removeEntryFromLocalHandle(activeHandle, node.relativePath);
        setStatusMessage(`DELETED "${node.name}" FROM LOCAL DISK`);
        if (selectedFile?.relativePath === node.relativePath) {
          setSelectedFile(null);
          setFileContent('');
        }
        fetchWorkspaceTree();
        if (onAssetPurged) onAssetPurged({ type: 'file', path: node.relativePath });
        if (onRefreshAppDocs) onRefreshAppDocs();
      } else {
        const queryParam = activeSource === 'local_backup' ? '&source=local' : '';
        const data: any = await requestApi(
          `/api/workspace?relativePath=${encodeURIComponent(node.relativePath)}${queryParam}`,
          { method: 'DELETE' },
          'DELETE_VAULT_FILE'
        );
        if (data && data.success) {
          setStatusMessage(`DELETED "${node.name}" FROM STORAGE`);
          if (selectedFile?.relativePath === node.relativePath) {
            setSelectedFile(null);
            setFileContent('');
          }
          fetchWorkspaceTree();
          if (onAssetPurged) {
            onAssetPurged({
              type: 'file',
              path: node.relativePath,
              purgedDocIds: data.purgedDocIds,
              purgedCategoryIds: data.purgedCategoryIds,
              purgedNodeIds: data.purgedNodeIds,
            });
          }
          if (onRefreshAppDocs) onRefreshAppDocs();
        }
      }
    } catch (err: any) {
      setStatusMessage(`DELETE FAILED: ${err.message}`);
    }
  };

  const handleDeleteFolder = async (node: FileTreeNode) => {
    if (!confirm(`Are you sure you want to permanently delete directory "${node.name}" and all of its assets?\n\nThis will cascade remove it from all boards, graph nodes, and documents.`)) return;

    try {
      const activeHandle = getActiveLocalDirectoryHandle();
      if (activeSource === 'local_backup' && activeHandle) {
        await removeEntryFromLocalHandle(activeHandle, node.relativePath);
        setStatusMessage(`DIRECTORY "${node.name}" AND CASCADED ASSETS PURGED FROM LOCAL DISK`);
        if (selectedFile?.relativePath && selectedFile.relativePath.startsWith(node.relativePath)) {
          setSelectedFile(null);
          setFileContent('');
        }
        fetchWorkspaceTree();
        if (onAssetPurged) {
          onAssetPurged({
            type: 'folder',
            path: node.relativePath,
          });
        }
        if (onRefreshAppDocs) onRefreshAppDocs();
      } else {
        const queryParam = activeSource === 'local_backup' ? '&source=local' : '';
        const data: any = await requestApi(
          `/api/workspace?relativePath=${encodeURIComponent(node.relativePath)}${queryParam}`,
          { method: 'DELETE' },
          'DELETE_VAULT_FOLDER'
        );
        if (data && data.success) {
          setStatusMessage(`DIRECTORY "${node.name}" AND CASCADED ASSETS PURGED`);
          if (selectedFile?.relativePath && selectedFile.relativePath.startsWith(node.relativePath)) {
            setSelectedFile(null);
            setFileContent('');
          }
          fetchWorkspaceTree();
          if (onAssetPurged) {
            onAssetPurged({
              type: 'folder',
              path: node.relativePath,
              purgedDocIds: data.purgedDocIds,
              purgedCategoryIds: data.purgedCategoryIds,
              purgedNodeIds: data.purgedNodeIds,
            });
          }
          if (onRefreshAppDocs) onRefreshAppDocs();
        }
      }
    } catch (err: any) {
      setStatusMessage(`FOLDER DELETE FAILED: ${err.message}`);
    }
  };

  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    setIsSaving(true);
    setStatusMessage(null);

    const cleanFileName = newFileName.trim().toLowerCase().replace(/\s+/g, '_');
    const safeName = cleanFileName.includes('.') ? cleanFileName : `${cleanFileName}.md`;
    const relativePath = newFolder ? `${newFolder.replace(/^\/+|\/+$/g, '')}/${safeName}` : safeName;
    const initialText = newContent || `# ${newFileName}\nCreated directly on ${new Date().toLocaleDateString()}`;

    try {
      const activeHandle = getActiveLocalDirectoryHandle();
      if (activeSource === 'local_backup' && activeHandle) {
        await writeLocalFileToHandle(activeHandle, relativePath, initialText);
        setStatusMessage(`CREATED FILE ON LOCAL DISK: ${relativePath}`);
        setNewFileName('');
        setNewContent('');
        setIsCreatingNew(false);
        fetchWorkspaceTree();
        if (onRefreshAppDocs) onRefreshAppDocs();
      } else {
        const queryParam = activeSource === 'local_backup' ? '?source=local' : '';
        const data: any = await requestApi(
          `/api/workspace${queryParam}`,
          {
            method: 'POST',
            body: JSON.stringify({
              relativePath,
              content: initialText,
            }),
          },
          'CREATE_VAULT_FILE'
        );

        if (data && data.success) {
          setStatusMessage(
            `CREATED FILE IN ${isCloudPrimary && activeSource === 'primary_storage' ? cloudProvider.replace('_', ' ').toUpperCase() : 'VAULT'}: ${relativePath}`
          );
          setNewFileName('');
          setNewContent('');
          setIsCreatingNew(false);
          fetchWorkspaceTree();
          if (onRefreshAppDocs) onRefreshAppDocs();
        } else {
          setStatusMessage(`ERROR: ${data?.error || 'Failed to create file'}`);
        }
      }
    } catch (err: any) {
      setStatusMessage(`CREATION FAILED: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.md') || fileName.endsWith('.txt')) return <FileText size={14} className="text-[#D4AF37]" />;
    if (fileName.endsWith('.json') || fileName.endsWith('.code') || fileName.endsWith('.js') || fileName.endsWith('.ts'))
      return <FileCode size={14} className="text-[#3A86FF]" />;
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.csv')) return <FileSpreadsheet size={14} className="text-[#2A9D8F]" />;
    return <FileText size={14} className="text-[#E76F51]" />;
  };

  const renderTreeNodes = (nodes?: FileTreeNode[]) => {
    if (!nodes || nodes.length === 0) return <div className="p-2 font-mono text-[10px] opacity-50">EMPTY DIRECTORY</div>;

    return nodes.map((node) => {
      if (node.isDirectory) {
        return (
          <div key={node.relativePath} className="ml-2 mt-1">
            <div className="group flex items-center justify-between font-mono text-xs font-black uppercase text-[#D4AF37] py-0.5 hover:bg-black/10 px-1 rounded transition-all">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <FolderOpen size={14} className="shrink-0" />
                <span className="truncate">{node.name} /</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(node);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 transition-all rounded"
                title={`Permanently delete directory "${node.name}" and cascade remove its assets`}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="border-l border-black/30 pl-2">
              {renderTreeNodes(node.children)}
            </div>
          </div>
        );
      }

      const isSelected = selectedFile?.relativePath === node.relativePath;

      return (
        <div
          key={node.relativePath}
          onClick={() => handleSelectFile(node)}
          className={`group flex items-center justify-between border border-black/20 p-1.5 font-mono text-xs cursor-pointer my-0.5 transition-all ${
            isSelected
              ? 'bg-[#D4AF37] text-black font-black shadow-[2px_2px_0px_#000000]'
              : 'bg-black/10 hover:bg-black/20'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {getFileIcon(node.name)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] opacity-70">{node.sizeFormatted}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(node);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500 hover:text-red-700"
              title="Delete File from Disk"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className={`flex flex-col w-full max-w-4xl h-[85vh] border-4 p-5 ${modalBg}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black/20 pb-3">
          <div className="flex items-center gap-2 font-mono text-sm font-black uppercase">
            <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-[#D4AF37] text-black shadow-[2px_2px_0px_#000000]">
              <HardDrive size={16} strokeWidth={2.5} />
            </div>
            <span>PHYSICAL WORKSPACE VAULT EXPLORER</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchWorkspaceTree}
              className="flex items-center gap-1 border-2 border-black bg-black/20 px-2.5 py-1 font-mono text-xs font-black uppercase hover:bg-black/40"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              REFRESH DISK
            </button>

            <Tooltip content="CLOSE VAULT EXPLORER">
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center border-2 border-black bg-black/20 hover:bg-red-600 hover:text-white"
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Source Selector Bar: Primary Storage (Backblaze B2) vs Local Disk Backup */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-black/30 p-2 shadow-[2px_2px_0px_#000000]">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveSource('primary_storage')}
              className={`border-2 border-black px-3 py-1 font-black uppercase text-[10px] flex items-center gap-1.5 transition-all shadow-[1px_1px_0px_#000000] cursor-pointer ${
                activeSource === 'primary_storage'
                  ? 'bg-[#D4AF37] text-black'
                  : 'bg-black/20 text-current hover:bg-black/40'
              }`}
            >
              <Cloud size={13} />
              <span>
                PRIMARY: {isCloudPrimary ? cloudProvider.replace('_', ' ').toUpperCase() : 'MAIN VAULT'}
              </span>
            </button>

            {hasLocalStorageOption && (
              <button
                type="button"
                onClick={() => setActiveSource('local_backup')}
                className={`border-2 border-black px-3 py-1 font-black uppercase text-[10px] flex items-center gap-1.5 transition-all shadow-[1px_1px_0px_#000000] cursor-pointer ${
                  activeSource === 'local_backup'
                    ? 'bg-[#10B981] text-black'
                    : 'bg-black/20 text-current hover:bg-black/40'
                }`}
              >
                <HardDrive size={13} />
                <span>LOCAL DISK BACKUP</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeSource === 'primary_storage' && isCloudPrimary && (
              <span className="bg-[#D4AF37] text-black border border-black px-2 py-0.5 font-mono text-[9px] font-black uppercase shadow-[1px_1px_0px_#000000]">
                PRIMARY CLOUD BUCKET ACTIVE
              </span>
            )}
            {activeSource === 'local_backup' && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase">
                LOCAL DISK REPLICA ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Path Info Banner */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-black/20 p-2.5 shadow-[2px_2px_0px_#000000]">
          <div className="flex items-center gap-2 font-mono text-xs truncate max-w-xl">
            {activeSource === 'primary_storage' && isCloudPrimary ? (
              <Cloud size={14} className="text-[#D4AF37] shrink-0" />
            ) : (
              <Terminal size={14} className="text-[#D4AF37] shrink-0" />
            )}
            <span className="opacity-60">
              {activeSource === 'primary_storage' && isCloudPrimary
                ? 'PRIMARY_CLOUD:'
                : activeSource === 'local_backup'
                ? 'LOCAL_BACKUP:'
                : 'STORAGE_PATH:'}
            </span>
            <span className="font-bold text-[#D4AF37] truncate">
              {activeSource === 'primary_storage' && isCloudPrimary
                ? `${bucketName ? `[${bucketName}] ` : ''}${canonicalPrefix || vaultPath}`
                : vaultPath}
            </span>
            {isCloudPrimary && activeSource === 'primary_storage' && (
              <span className="text-[9px] bg-black/50 border border-[#D4AF37]/50 text-[#D4AF37] px-1.5 py-0.5 font-mono font-bold">
                {cloudProvider.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] font-black uppercase">
            <span>FILES: {stats.fileCount}</span>
            <span>FOLDERS: {stats.folderCount}</span>
          </div>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div className="mt-2 border-2 border-black bg-[#2A9D8F] p-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] flex items-center justify-between">
            <span className="truncate mr-2">{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="ml-auto hover:bg-black/20 p-0.5 cursor-pointer"
              aria-label="Dismiss message"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Split Pane: Tree & Editor */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 overflow-hidden">
          {/* Left Pane: Tree View & New File Button */}
          <div className="md:col-span-5 flex flex-col border-2 border-black bg-black/15 p-3 overflow-hidden shadow-[3px_3px_0px_#000000]">
            <div className="flex items-center justify-between border-b border-black/20 pb-2 mb-2">
              <span className="font-mono text-xs font-black uppercase text-[#D4AF37]">
                [DIRECTORY TREE]
              </span>
              <Tooltip content="NEW FILE ON DISK">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(true);
                    setSelectedFile(null);
                  }}
                  className="flex h-6 w-6 items-center justify-center border border-black bg-[#D4AF37] text-black shadow-[1px_1px_0px_#000000] hover:bg-[#c5a059]"
                  aria-label="New file on disk"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {tree && tree.children ? (
                renderTreeNodes(tree.children)
              ) : (
                <div className="font-mono text-xs opacity-50 p-4 text-center">
                  SCANNING DISK...
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: File Reader & Editor OR New File Creator */}
          <div className="md:col-span-7 flex flex-col border-2 border-black bg-black/15 p-3 overflow-hidden shadow-[3px_3px_0px_#000000]">
            {isCreatingNew ? (
              <form onSubmit={handleCreateNewFile} className="flex flex-col h-full gap-3">
                <div className="flex items-center justify-between border-b border-black/20 pb-2">
                  <span className="font-mono text-xs font-black uppercase text-[#D4AF37]">
                    WRITE NEW PHYSICAL FILE TO DISK
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="font-mono text-[10px] uppercase text-red-500 hover:underline"
                  >
                    CANCEL
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-mono text-[10px] font-black uppercase mb-1">TARGET FOLDER</label>
                    <select
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      className="w-full border-2 border-black bg-black/20 px-2 py-1.5 font-mono text-xs font-bold uppercase focus:outline-none"
                    >
                      <option value="">/ (WORKSPACE ROOT)</option>
                      {availableFolders.filter(Boolean).map((f) => (
                        <option key={f} value={f}>
                          {f}/
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-black uppercase mb-1">FILE NAME</label>
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="e.g. sprint_notes.md"
                      className="w-full border-2 border-black bg-black/20 px-2 py-1.5 font-mono text-xs font-bold uppercase focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block font-mono text-[10px] font-black uppercase mb-1">FILE CONTENT</label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="# WRITE CONTENT HERE..."
                    className="w-full flex-1 border-2 border-black bg-black/20 p-2 font-mono text-xs focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 border-2 border-black bg-[#D4AF37] py-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-[#c5a059]"
                >
                  <Save size={14} />
                  {isSaving ? 'WRITING FILE...' : 'CREATE FILE ON PHYSICAL DISK'}
                </button>
              </form>
            ) : selectedFile ? (
              <div className="flex flex-col h-full gap-2">
                <div className="flex items-center justify-between border-b border-black/20 pb-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-black uppercase truncate">
                    {getFileIcon(selectedFile.name)}
                    <span className="text-[#D4AF37] truncate">{selectedFile.name}</span>
                    <span className="text-[10px] opacity-60">({selectedFile.sizeFormatted})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveFileContent}
                      disabled={isSaving}
                      className="flex items-center gap-1 border border-black bg-[#D4AF37] px-3 py-1 font-mono text-xs font-black uppercase text-black shadow-[1px_1px_0px_#000000] hover:bg-[#c5a059]"
                    >
                      <Save size={12} />
                      {isSaving ? 'SAVING...' : 'SAVE TO DISK'}
                    </button>
                  </div>
                </div>

                <div className="font-mono text-[10px] opacity-60 bg-black/20 p-1 border border-black truncate">
                  ABSOLUTE: {selectedFile.absolutePath}
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full flex-1 border-2 border-black bg-black/20 p-2.5 font-mono text-xs leading-relaxed focus:outline-none resize-none"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60 font-mono">
                <FileText size={40} className="mb-2 text-[#D4AF37]" />
                <p className="text-xs font-black uppercase">NO FILE SELECTED</p>
                <p className="text-[11px] mt-1 max-w-xs">
                  Select any physical file from the left directory tree to read and edit its contents live on disk, or create a new file directly inside <code className="text-[#D4AF37]">docustack_vault/</code>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-black/20 pt-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 opacity-70">
            <Info size={14} className="text-[#D4AF37]" />
            <span>All file read/write actions immediately persist to your local workspace disk folder.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black bg-[#D4AF37] px-6 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000000] hover:bg-[#c5a059]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  HardDrive,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
  Sparkles,
  Save,
  CheckCircle2,
  FolderPlus,
  Compass,
  Monitor,
  ChevronRight,
  ArrowUp,
  Plus,
  Home,
  FileText,
} from 'lucide-react';
import { BrutalistButton, BrutalistCard, BrutalistInput, BrutalistBadge } from '../BrutalistUi';
import { UserAccount } from '@/lib/types';
import { formatCanonicalWorkspaceFolderName, formatCanonicalWorkspacePath } from '@/lib/workspace-canonical';

interface WorkspaceFolderSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  onWorkspaceConfigured: (workspace: { path: string; name: string }) => void;
}

interface BrowseFolderItem {
  name: string;
  path: string;
  displayPath: string;
  itemCount?: number;
  modifiedAt?: string;
}

interface BrowseResponse {
  currentPath: string;
  displayPath: string;
  parentPath: string | null;
  parentDisplayPath: string | null;
  canWrite: boolean;
  folders: BrowseFolderItem[];
  presets: Array<{ name: string; path: string; display: string }>;
}

export default function WorkspaceFolderSelectorModal({
  isOpen,
  onClose,
  currentUser,
  onWorkspaceConfigured,
}: WorkspaceFolderSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<'presets' | 'browse'>('presets');
  const [workspaceName, setWorkspaceName] = useState('DocuStack Vault');
  const [workspacePath, setWorkspacePath] = useState('./docustack_vault');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedInfo, setVerifiedInfo] = useState<{
    resolvedPath: string;
    exists: boolean;
    fileCount: number;
    folderCount: number;
  } | null>(null);
  const [stats, setStats] = useState<{ fileCount: number; folderCount: number; vaultPath: string; vaultName: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Directory Browser State
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing user workspace config and current workspace info
  useEffect(() => {
    if (isOpen) {
      const initialPath = currentUser?.workspacePath || localStorage.getItem('docustack_workspace_path') || './docustack_vault';
      const initialName = currentUser?.workspaceName || localStorage.getItem('docustack_workspace_name') || 'DocuStack Vault';
      
      setWorkspacePath(initialPath);
      setWorkspaceName(initialName);
      setStatusMessage(null);
      setVerifiedInfo(null);

      fetchCurrentWorkspaceInfo();
      verifyPathOnDisk(initialPath);
      loadBrowseDirectory(initialPath);
    }
  }, [isOpen, currentUser]);

  const fetchCurrentWorkspaceInfo = async () => {
    try {
      const url = currentUser ? `/api/workspace?userId=${currentUser.id}` : '/api/workspace';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStats({
          fileCount: data.stats?.fileCount || 0,
          folderCount: data.stats?.folderCount || 0,
          vaultPath: data.vaultPath || './docustack_vault',
          vaultName: data.vaultName || 'DocuStack Vault',
        });
        if (!currentUser?.workspacePath && data.vaultPath) {
          setWorkspacePath(data.vaultPath);
        }
        if (!currentUser?.workspaceName && data.vaultName) {
          setWorkspaceName(data.vaultName);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch workspace info:', err);
    }
  };

  const verifyPathOnDisk = async (pathToVerify: string) => {
    if (!pathToVerify || !pathToVerify.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          workspacePath: pathToVerify.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifiedInfo({
          resolvedPath: data.resolvedPath,
          exists: data.exists,
          fileCount: data.fileCount || 0,
          folderCount: data.folderCount || 0,
        });
      }
    } catch (e) {
      console.warn('Failed to verify path:', e);
    } finally {
      setVerifying(false);
    }
  };

  const loadBrowseDirectory = async (dirPath?: string) => {
    setBrowseLoading(true);
    try {
      const query = dirPath ? `?dir=${encodeURIComponent(dirPath)}` : '';
      const res = await fetch(`/api/workspace/browse${query}`);
      const data = await res.json();
      if (data.success) {
        setBrowseData(data);
      } else {
        // If current path fails, try default homedir
        const fallbackRes = await fetch('/api/workspace/browse');
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success) {
          setBrowseData(fallbackData);
        }
      }
    } catch (err) {
      console.warn('Browse error:', err);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleSelectBrowserFolder = (folderPath: string, folderName?: string) => {
    const derivedName = folderName || folderPath.split('/').filter(Boolean).pop() || 'DocuStack Vault';
    setWorkspacePath(folderPath);
    setWorkspaceName(derivedName);
    verifyPathOnDisk(folderPath);
    setStatusMessage({
      type: 'success',
      text: `Selected folder "${derivedName}". Click SAVE & APPLY WORKSPACE below to use this folder.`,
    });
  };

  const handleCreateNewFolder = async () => {
    if (!newFolderName.trim() || !browseData?.currentPath) return;
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/workspace/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: browseData.currentPath,
          folderName: newFolderName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName('');
        setShowNewFolderInput(false);
        await loadBrowseDirectory(browseData.currentPath);
        handleSelectBrowserFolder(data.createdPath, newFolderName.trim());
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to create folder' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error creating folder' });
    } finally {
      setCreatingFolder(false);
    }
  };

  // Open native system folder selector using the File System Access API
  const handleOpenNativeFolderPicker = async () => {
    setStatusMessage(null);
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        });
        
        if (handle && handle.name) {
          const pickedName = handle.name;
          const proposedPath = `./${pickedName}`;
          setWorkspaceName(pickedName);
          setWorkspacePath(proposedPath);
          
          setStatusMessage({
            type: 'success',
            text: `Successfully mapped local directory "${pickedName}". Click SAVE to apply.`,
          });
          
          verifyPathOnDisk(proposedPath);
        }
      } else {
        // Fallback to HTML5 directory input
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Native folder selection fallback:', err);
      // Open directory browser view
      setActiveTab('browse');
      loadBrowseDirectory();
    }
  };

  const handleHtml5DirectorySelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relativePath = firstFile.webkitRelativePath || '';
      const folderName = relativePath.split('/')[0] || 'Selected Folder';
      const proposedPath = `./${folderName}`;
      setWorkspaceName(folderName);
      setWorkspacePath(proposedPath);
      verifyPathOnDisk(proposedPath);
      setStatusMessage({
        type: 'success',
        text: `Selected folder "${folderName}". Click SAVE & APPLY WORKSPACE below.`,
      });
    }
  };

  if (!isOpen) return null;

  // Save & Apply Workspace configuration
  const handleSaveWorkspaceConfig = async () => {
    if (!workspaceName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide a Workspace Folder Name.' });
      return;
    }
    if (!workspacePath.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide a Workspace Folder Path.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const targetName = workspaceName.trim();
      const currentUserName = currentUser?.username || currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'user');
      const targetPath = formatCanonicalWorkspacePath('docustack', currentUserName, targetName);

      // 1. Configure workspace backend & create physical directories
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          workspacePath: targetPath,
          workspaceName: targetName,
          userId: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to configure workspace directory');
      }

      // 2. Update user profile if logged in
      if (currentUser?.id) {
        await fetch('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspacePath: targetPath,
            workspaceName: targetName,
          }),
        });
      }

      // 3. Save to localStorage for client machine persistence
      localStorage.setItem('docustack_workspace_path', targetPath);
      localStorage.setItem('docustack_workspace_name', targetName);

      setStatusMessage({
        type: 'success',
        text: `Workspace "${targetName}" configured and saved! Folder initialized at ${data.vaultPath}`,
      });

      onWorkspaceConfigured({
        path: targetPath,
        name: targetName,
      });

      await fetchCurrentWorkspaceInfo();

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to save workspace configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs select-none">
      <BrutalistCard
        variant="surface"
        depth="lg"
        className="w-full max-w-2xl max-h-[92vh] p-5 sm:p-6 border-2 border-[#D4AF37] flex flex-col font-mono animate-in fade-in zoom-in-95 overflow-y-auto bg-[#141310] shadow-[8px_8px_0px_#D4AF37]"
      >
        {/* Hidden HTML5 folder input for universal browser fallback */}
        <input
          type="file"
          ref={fileInputRef}
          // @ts-expect-error webkitdirectory is standard for folder picking
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleHtml5DirectorySelected}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#D4AF37] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-[#D4AF37] bg-[#D4AF37] text-black">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#F3EDE0]">
                SELECT WORKSPACE FOLDER
              </h2>
              <p className="text-[10px] text-[#D4AF37] opacity-80">
                Choose or create any local folder on your computer for your DocuStack workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 border border-[#D4AF37] text-[#F3EDE0] hover:bg-[#D4AF37] hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`my-3 p-3 border-2 text-xs flex items-center gap-2 shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : statusMessage.type === 'error'
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-blue-500/20 border-blue-500 text-blue-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 text-red-400" />
            )}
            <span className="font-bold">{statusMessage.text}</span>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 my-3 border-b border-[#D4AF37]/30 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-[#D4AF37] text-black shadow-[2px_2px_0px_#000000]'
                : 'bg-[#1C1A15] text-[#D4AF37] hover:bg-[#26241D]'
            }`}
          >
            <Sparkles size={13} />
            <span>QUICK PRESETS & MANUAL PATH</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('browse');
              if (!browseData) loadBrowseDirectory(workspacePath);
            }}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'browse'
                ? 'bg-[#D4AF37] text-black shadow-[2px_2px_0px_#000000]'
                : 'bg-[#1C1A15] text-[#D4AF37] hover:bg-[#26241D]'
            }`}
          >
            <Compass size={13} />
            <span>INTERACTIVE FOLDER BROWSER</span>
          </button>
        </div>

        {/* TAB 1: PRESETS & MANUAL PATH */}
        {activeTab === 'presets' && (
          <div className="space-y-4 my-2">
            {/* Quick Presets Shortcuts */}
            <div className="p-3 border-2 border-[#D4AF37]/40 bg-[#16151B] space-y-2">
              <span className="text-[10px] font-black uppercase text-[#D4AF37] block">
                ⚡ POPULAR RECOMMENDED FOLDERS:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspacePath('./docustack_vault');
                    setWorkspaceName('DocuStack Vault');
                    verifyPathOnDisk('./docustack_vault');
                  }}
                  className="p-2 border border-[#D4AF37]/50 bg-[#1A1813] hover:bg-[#D4AF37]/20 text-left transition-colors flex items-center gap-2"
                >
                  <HardDrive size={16} className="text-[#D4AF37] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs block text-[#F3EDE0]">Default Local Vault</span>
                    <span className="text-[10px] text-[#D4AF37]/70 font-mono block">./docustack_vault</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspacePath('~/Documents/DocuStack');
                    setWorkspaceName('Documents Vault');
                    verifyPathOnDisk('~/Documents/DocuStack');
                  }}
                  className="p-2 border border-[#D4AF37]/50 bg-[#1A1813] hover:bg-[#D4AF37]/20 text-left transition-colors flex items-center gap-2"
                >
                  <FileText size={16} className="text-[#D4AF37] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs block text-[#F3EDE0]">User Documents</span>
                    <span className="text-[10px] text-[#D4AF37]/70 font-mono block">~/Documents/DocuStack</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkspacePath('~/Desktop/DocuStack');
                    setWorkspaceName('Desktop Vault');
                    verifyPathOnDisk('~/Desktop/DocuStack');
                  }}
                  className="p-2 border border-[#D4AF37]/50 bg-[#1A1813] hover:bg-[#D4AF37]/20 text-left transition-colors flex items-center gap-2"
                >
                  <Monitor size={16} className="text-[#D4AF37] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs block text-[#F3EDE0]">Desktop Folder</span>
                    <span className="text-[10px] text-[#D4AF37]/70 font-mono block">~/Desktop/DocuStack</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('browse');
                    loadBrowseDirectory();
                  }}
                  className="p-2 border border-[#D4AF37]/50 bg-[#1A1813] hover:bg-[#D4AF37]/20 text-left transition-colors flex items-center gap-2"
                >
                  <Compass size={16} className="text-[#D4AF37] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs block text-[#F3EDE0]">Browse All Folders →</span>
                    <span className="text-[10px] text-[#D4AF37]/70 font-mono block">Explore Mac filesystem</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Native OS Folder Select Button */}
            <div className="p-3 border-2 border-dashed border-[#D4AF37]/40 bg-black/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-[#F3EDE0] block">
                  OPEN SYSTEM FINDER / FILE EXPLORER
                </span>
                <span className="text-[10px] text-[#D4AF37] opacity-80 block">
                  Click to select any existing folder natively from your computer
                </span>
              </div>
              <BrutalistButton
                variant="accent"
                type="button"
                onClick={handleOpenNativeFolderPicker}
                className="text-xs py-2 px-4 shrink-0 font-black"
              >
                <FolderOpen size={14} className="mr-1.5 inline" />
                CHOOSE FOLDER...
              </BrutalistButton>
            </div>

            {/* Manual Path Inputs */}
            <div className="p-3 border-2 border-[#D4AF37]/40 bg-[#16151B] space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1 text-[#D4AF37]">
                  Workspace Display Name:
                </label>
                <BrutalistInput
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. DocuStack Vault, Research Lab, Project Alpha"
                  className="text-xs bg-[#121116]"
                />
              </div>

              <div className="p-2.5 border border-[#D4AF37]/50 bg-[#0E0D11] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#D4AF37]">
                    CANONICAL VAULT FOLDER:
                  </span>
                  <span className="text-[9px] opacity-70 uppercase font-mono text-[#D4AF37]">ECOSYSTEM STANDARD</span>
                </div>
                <code className="text-xs font-mono font-bold text-emerald-400 block truncate">
                  {formatCanonicalWorkspaceFolderName('docustack', currentUser?.username || currentUser?.name || currentUser?.email?.split('@')[0] || 'user', workspaceName || 'vault')}
                </code>
                <span className="text-[9px] text-[#D4AF37] opacity-70 block">
                  Deterministic format: ultrst_docustack_{'{user_name}'}_{'{workspace_name}'}
                </span>
              </div>

              {/* Path Verification Result */}
              {verifiedInfo && (
                <div className="p-2.5 border border-[#D4AF37]/50 bg-[#0E0D11] space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[9px] opacity-70 uppercase text-[#D4AF37]">RESOLVED HOST PATH:</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      verifiedInfo.exists ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    }`}>
                      {verifiedInfo.exists ? 'DIRECTORY EXISTS ON DISK' : 'WILL BE CREATED ON SAVE'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#F3EDE0] break-all">
                    {verifiedInfo.resolvedPath}
                  </div>
                  {verifiedInfo.exists && (
                    <div className="text-[10px] opacity-80 pt-0.5 text-[#D4AF37]">
                      Contains {verifiedInfo.folderCount} subfolders and {verifiedInfo.fileCount} files.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE DIRECTORY BROWSER */}
        {activeTab === 'browse' && (
          <div className="space-y-3 my-2">
            {/* Current Navigation Bar */}
            <div className="p-2.5 border-2 border-[#D4AF37]/60 bg-[#16151B] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#F3EDE0] truncate max-w-md">
                <Home size={14} className="text-[#D4AF37] shrink-0" />
                <span className="font-mono font-bold truncate text-[#D4AF37]">
                  {browseData?.displayPath || '~'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {browseData?.parentPath && (
                  <button
                    type="button"
                    onClick={() => loadBrowseDirectory(browseData.parentPath!)}
                    disabled={browseLoading}
                    className="px-2 py-1 text-[10px] font-black border border-[#D4AF37] bg-[#1E1B10] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUp size={11} />
                    <span>UP ONE LEVEL</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="px-2 py-1 text-[10px] font-black border border-[#D4AF37] bg-[#1E1B10] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>NEW FOLDER</span>
                </button>
              </div>
            </div>

            {/* New Folder Creation Bar */}
            {showNewFolderInput && (
              <div className="p-2.5 border border-[#D4AF37] bg-[#1A1813] flex items-center gap-2">
                <FolderPlus size={16} className="text-[#D4AF37] shrink-0" />
                <input
                  type="text"
                  placeholder="Folder name (e.g. My_DocuStack_Vault)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNewFolder()}
                  className="flex-1 p-1 bg-[#121116] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateNewFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="px-3 py-1 bg-[#D4AF37] text-black font-black text-xs hover:bg-[#E5C158] transition-colors cursor-pointer"
                >
                  {creatingFolder ? 'CREATING...' : 'CREATE'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput(false)}
                  className="p-1 text-[#F3EDE0]/60 hover:text-[#F3EDE0]"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Select Current Folder Action Banner */}
            {browseData?.currentPath && (
              <div className="p-2.5 border border-emerald-500/50 bg-emerald-500/10 flex items-center justify-between gap-2">
                <div className="text-xs truncate">
                  <span className="text-emerald-400 font-bold block text-[10px] uppercase">
                    CURRENT DIRECTORY LOCATION:
                  </span>
                  <span className="font-mono text-xs text-[#F3EDE0] truncate block">
                    {browseData.displayPath}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectBrowserFolder(browseData.currentPath)}
                  className="px-3 py-1.5 bg-emerald-500 text-black font-black text-xs uppercase hover:bg-emerald-400 transition-colors shrink-0 shadow-[2px_2px_0px_#000000] cursor-pointer"
                >
                  ⚡ USE THIS FOLDER
                </button>
              </div>
            )}

            {/* Folder List Grid */}
            <div className="p-2 border-2 border-[#D4AF37]/30 bg-[#0E0D11] max-h-56 overflow-y-auto space-y-1">
              {browseLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#D4AF37]">
                  <RefreshCw size={16} className="animate-spin" />
                  <span>READING DIRECTORIES...</span>
                </div>
              ) : !browseData?.folders || browseData.folders.length === 0 ? (
                <div className="py-6 text-center text-xs opacity-50 text-[#F3EDE0]">
                  No subdirectories found in this folder.
                </div>
              ) : (
                browseData.folders.map((folder) => (
                  <div
                    key={folder.path}
                    className="p-2 border border-[#D4AF37]/20 bg-[#16151B] hover:border-[#D4AF37] hover:bg-[#1E1B10] transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                    onClick={() => loadBrowseDirectory(folder.path)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder size={16} className="text-[#D4AF37] shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-[#F3EDE0] group-hover:text-[#D4AF37] truncate">
                        {folder.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {folder.itemCount !== undefined && (
                        <span className="text-[9px] text-[#D4AF37]/70 font-mono">
                          {folder.itemCount} items
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectBrowserFolder(folder.path, folder.name);
                        }}
                        className="px-2 py-0.5 border border-[#D4AF37]/60 bg-[#141310] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black text-[9px] font-black uppercase transition-colors"
                        title="Select this folder as workspace"
                      >
                        SELECT
                      </button>
                      <ChevronRight size={14} className="text-[#D4AF37]/50 group-hover:text-[#D4AF37]" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-[#D4AF37] mt-auto">
          <BrutalistButton variant="ghost" onClick={onClose} disabled={loading} className="text-xs">
            CANCEL
          </BrutalistButton>

          <div className="flex items-center gap-2">
            <BrutalistButton
              variant="accent"
              onClick={handleSaveWorkspaceConfig}
              disabled={loading}
              className="text-xs py-2 px-4"
            >
              <Save size={14} className="mr-1.5 inline" />
              {loading ? 'SAVING WORKSPACE...' : 'SAVE & APPLY WORKSPACE'}
            </BrutalistButton>
          </div>
        </div>
      </BrutalistCard>
    </div>
  );
}

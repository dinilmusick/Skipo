'use client';

import React, { useState } from 'react';
import {
  Layers,
  Moon,
  Sun,
  Plus,
  Upload,
  Activity,
  Zap,
  ZapOff,
  GitFork,
  ArrowLeft,
  Sliders,
  HardDrive,
  Briefcase,
  Kanban,
  Tag,
  Search,
  FolderOpen,
  User,
  LogIn,
  ShieldCheck,
  Copy,
  Save,
  Check,
  RefreshCw,
} from 'lucide-react';
import Tooltip from './Tooltip';
import { BiomeType, ThemeMode, UserAccount } from '../lib/types';
import { BrutalistButton, BrutalistCard, BrutalistBadge } from './BrutalistUi';
import { formatCanonicalWorkspaceFolderName } from '../lib/workspace-canonical';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  biome: BiomeType;
  onChangeBiome: (b: BiomeType) => void;
  motionEnabled: boolean;
  onToggleMotion: () => void;
  onOpenCreateCategory: () => void;
  onUploadClick: () => void;
  onToggleMonitor: () => void;
  isMonitorOpen: boolean;
  docCount: number;
  catCount: number;
  viewMode: 'graph' | 'kanban' | 'work' | 'tags' | 'search';
  onChangeViewMode: (mode: 'graph' | 'kanban' | 'work' | 'tags' | 'search') => void;
  workspaceName?: string;
  currentCollectionTitle?: string;
  onReturnToGraph: () => void;
  onOpenSettings: () => void;
  onOpenVaultExplorer?: () => void;
  currentUser?: Omit<UserAccount, 'passwordHash'> | null;
  onOpenLogin: () => void;
  onOpenMediaVault: () => void;
  onOpenWorkspaceFolderSelector: () => void;
  onOpenWorkspacesTilesMenu?: () => void;
  onOpenAdminPanel?: () => void;
  autoSaveEnabled?: boolean;
  onToggleAutoSave?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'dirty';
  onManualSave?: () => void;
}

export default function Header({
  theme,
  onToggleTheme,
  biome,
  onChangeBiome,
  motionEnabled,
  onToggleMotion,
  onOpenCreateCategory,
  onUploadClick,
  onToggleMonitor,
  isMonitorOpen,
  docCount,
  catCount,
  viewMode,
  onChangeViewMode,
  workspaceName,
  currentCollectionTitle,
  onReturnToGraph,
  onOpenSettings,
  onOpenVaultExplorer,
  currentUser,
  onOpenLogin,
  onOpenMediaVault,
  onOpenWorkspaceFolderSelector,
  onOpenWorkspacesTilesMenu,
  onOpenAdminPanel,
  autoSaveEnabled = true,
  onToggleAutoSave,
  saveStatus = 'idle',
  onManualSave,
}: HeaderProps) {
  const isDark = theme === 'dark';
  const [headerCopied, setHeaderCopied] = useState(false);
  const currentUserName =
    currentUser?.username || currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'user');
  const rawFolderName =
    (currentUser?.workspacePath || '').replace(/^\.\//, '') ||
    formatCanonicalWorkspaceFolderName('docustack', currentUserName, workspaceName || 'vault');

  return (
    <BrutalistCard
      variant="surface"
      depth="md"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 p-2.5"
    >
      {/* Navigation & Mode Selector Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border-2 border-brutalist bg-black/15 p-0.5 shadow-[1px_1px_0px_var(--color-border)]" style={{ borderColor: 'var(--color-border)' }}>
          {viewMode === 'kanban' ? (
            <Tooltip content="RETURN TO WORKSPACE NODE GRAPH">
              <BrutalistButton
                variant="accent"
                size="icon"
                onClick={onReturnToGraph}
              >
                <ArrowLeft size={16} />
              </BrutalistButton>
            </Tooltip>
          ) : (
            <Tooltip content="WORKSPACE NODE GRAPH">
              <BrutalistButton
                variant={viewMode === 'graph' ? 'accent' : 'ghost'}
                size="icon"
                onClick={() => onChangeViewMode('graph')}
                active={viewMode === 'graph'}
              >
                <GitFork size={16} />
              </BrutalistButton>
            </Tooltip>
          )}

          <Tooltip content="WORK DESK VIEW">
            <BrutalistButton
              variant={viewMode === 'work' ? 'accent' : 'ghost'}
              size="icon"
              onClick={() => onChangeViewMode('work')}
              active={viewMode === 'work'}
            >
              <Briefcase size={16} />
            </BrutalistButton>
          </Tooltip>

          <Tooltip content="TAG SIMILARITY FORCE GRAPH">
            <BrutalistButton
              variant={viewMode === 'tags' ? 'accent' : 'ghost'}
              size="icon"
              onClick={() => onChangeViewMode('tags')}
              active={viewMode === 'tags'}
            >
              <Tag size={16} />
            </BrutalistButton>
          </Tooltip>

          <Tooltip content="SEARCH ASSETS (KANBANS, DOCS, FOLDERS, GROUPS, STICKY NOTES)">
            <BrutalistButton
              variant={viewMode === 'search' ? 'accent' : 'ghost'}
              size="icon"
              onClick={() => onChangeViewMode('search')}
              active={viewMode === 'search'}
            >
              <Search size={16} />
            </BrutalistButton>
          </Tooltip>
        </div>

        {/* Clickable Workspace Selector Button with Raw Folder Name Copyable underneath */}
        <Tooltip content="OPEN WORKSPACES TILES MENU & STORAGE SELECTOR (CLICK RAW FOLDER TO COPY)">
          <div className="flex flex-col items-start border-2 border-brutalist bg-black/10 shadow-[1.5px_1.5px_0px_var(--color-border)] px-2.5 py-0.5">
            <button
              onClick={onOpenWorkspacesTilesMenu || onOpenWorkspaceFolderSelector}
              className="flex items-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider hover:text-[var(--color-accent)] transition-colors cursor-pointer text-left w-full"
            >
              <FolderOpen size={13} className="text-[var(--color-accent)] shrink-0" />
              <span className="truncate max-w-[170px]">{workspaceName || currentUser?.workspaceName || 'DOCUSTACK_VAULT'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(rawFolderName);
                setHeaderCopied(true);
                setTimeout(() => setHeaderCopied(false), 2000);
              }}
              className="text-[9px] font-mono lowercase opacity-65 hover:opacity-100 hover:text-[var(--color-accent)] hover:underline cursor-pointer truncate max-w-[170px] flex items-center gap-1"
              title="Click to copy raw folder name"
            >
              <span className="truncate">{rawFolderName}</span>
              {headerCopied ? (
                <span className="text-[8px] bg-emerald-400 text-black px-1 font-bold">COPIED</span>
              ) : (
                <Copy size={9} className="opacity-60 shrink-0" />
              )}
            </button>
          </div>
        </Tooltip>

        <div className="flex items-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider">
          {viewMode === 'kanban' && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-current opacity-90 truncate max-w-[180px] font-black">{currentCollectionTitle || 'KANBAN_BOARD'}</span>
            </>
          )}
          {viewMode === 'work' && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-current opacity-90 font-black">WORK_DESK</span>
            </>
          )}
          {viewMode === 'tags' && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-current opacity-90 font-black">TAG_SIMILARITY_GRAPH</span>
            </>
          )}
          {viewMode === 'search' && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-current opacity-90 font-black">ASSET_SEARCH_WINDOW</span>
            </>
          )}
        </div>

        {/* Numeric Badges */}
        {viewMode === 'kanban' && (
          <div className="flex items-center gap-1 font-mono text-xs font-black">
            <Tooltip content={`${docCount} DOCUMENTS`}>
              <div 
                className="flex h-8 items-center gap-1 border-2 border-brutalist bg-black/10 px-2 shadow-[1.5px_1.5px_0px_var(--color-border)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="opacity-60">D:</span>
                <span>{docCount}</span>
              </div>
            </Tooltip>
            <Tooltip content={`${catCount} STACKS`}>
              <div 
                className="flex h-8 items-center gap-1 border-2 border-brutalist bg-black/10 px-2 shadow-[1.5px_1.5px_0px_var(--color-border)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="opacity-60">S:</span>
                <span>{catCount}</span>
              </div>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Actions & Settings Strip */}
      <div className="flex items-center gap-2">
        {viewMode === 'kanban' && (
          <>
            <Tooltip content="IMPORT FILE">
              <BrutalistButton
                variant="accent"
                onClick={onUploadClick}
              >
                <Upload size={16} strokeWidth={2.5} />
              </BrutalistButton>
            </Tooltip>

            <Tooltip content="CREATE STACK">
              <BrutalistButton
                variant="secondary"
                onClick={onOpenCreateCategory}
              >
                <Plus size={18} strokeWidth={2.5} />
              </BrutalistButton>
            </Tooltip>
          </>
        )}

        {/* Auto-Save Toggle & Manual Save Control */}
        {onToggleAutoSave && (
          <Tooltip
            content={
              autoSaveEnabled
                ? 'AUTO-SAVE: ON (ALL CHANGES SAVED AUTOMATICALLY — CLICK TO TOGGLE OFF)'
                : 'AUTO-SAVE: OFF (CLICK TO TOGGLE ON, OR PRESS CMD+S / CTRL+S TO SAVE)'
            }
          >
            <div className="flex items-center">
              <button
                type="button"
                onClick={onToggleAutoSave}
                className={`flex items-center gap-1.5 px-2.5 h-8 border-2 font-mono text-[11px] font-black tracking-wider uppercase transition-all shadow-[1.5px_1.5px_0px_var(--color-border)] cursor-pointer ${
                  autoSaveEnabled
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    : 'border-amber-500/80 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                }`}
                style={{ borderColor: autoSaveEnabled ? '#10B981' : '#F59E0B' }}
                aria-label={autoSaveEnabled ? 'Toggle auto-save off' : 'Toggle auto-save on'}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-[var(--color-accent)]" />
                    <span>SAVING...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span>SAVED</span>
                  </>
                ) : autoSaveEnabled ? (
                  <>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AUTO-SAVE</span>
                  </>
                ) : (
                  <>
                    <Save size={13} className={saveStatus === 'dirty' ? 'text-amber-400' : 'opacity-70'} />
                    <span>{saveStatus === 'dirty' ? 'SAVE (CMD+S)' : 'MANUAL'}</span>
                  </>
                )}
              </button>

              {!autoSaveEnabled && onManualSave && (
                <Tooltip content="SAVE WORKSPACE NOW (CMD+S / CTRL+S)">
                  <button
                    type="button"
                    onClick={onManualSave}
                    className="ml-1 px-2 h-8 border-2 border-[var(--color-border)] bg-[var(--color-accent)] text-black font-mono text-xs font-black uppercase flex items-center justify-center hover:opacity-90 shadow-[1.5px_1.5px_0px_var(--color-border)] cursor-pointer"
                    aria-label="Save workspace now"
                  >
                    <Save size={13} strokeWidth={2.5} />
                  </button>
                </Tooltip>
              )}
            </div>
          </Tooltip>
        )}

        {onOpenVaultExplorer && (
          <Tooltip content="PHYSICAL VAULT FILE EXPLORER">
            <BrutalistButton
              variant="accent"
              onClick={onOpenVaultExplorer}
            >
              <HardDrive size={16} strokeWidth={2.5} />
            </BrutalistButton>
          </Tooltip>
        )}

        <Tooltip content={motionEnabled ? 'D3 PHYSICS & MOTION: ON' : 'D3 PHYSICS & MOTION: OFF'}>
          <BrutalistButton
            variant={motionEnabled ? 'accent' : 'subtle'}
            onClick={onToggleMotion}
          >
            {motionEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
          </BrutalistButton>
        </Tooltip>

        <Tooltip content={isDark ? 'THEME: COFFEE (LIGHT)' : 'THEME: BLACK & GOLD (DARK)'}>
          <BrutalistButton
            variant="subtle"
            onClick={onToggleTheme}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </BrutalistButton>
        </Tooltip>

        {/* User Account / Profile button */}
        <Tooltip content={currentUser ? `LOGGED IN AS ${currentUser.name.toUpperCase()} (${currentUser.role.toUpperCase()})` : 'SIGN IN / USER ACCOUNTS'}>
          <BrutalistButton
            variant={currentUser ? 'accent' : 'subtle'}
            onClick={onOpenLogin}
            className="flex items-center gap-1 font-mono text-xs font-black"
          >
            {currentUser ? (
              <>
                <span className="text-sm">{currentUser.avatarGlyph || '👤'}</span>
                <span className="hidden sm:inline truncate max-w-[80px]">{currentUser.name}</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                <span className="hidden sm:inline">LOGIN</span>
              </>
            )}
          </BrutalistButton>
        </Tooltip>

        {/* Admin Control Plane (Admin Only) */}
        {currentUser?.role === 'admin' && onOpenAdminPanel && (
          <Tooltip content="CONTROL PLANE & ADMIN BACKEND (ADMIN ONLY)">
            <BrutalistButton
              variant="accent"
              onClick={onOpenAdminPanel}
              className="flex items-center gap-1 font-mono text-xs font-black bg-[var(--color-accent)] text-white"
            >
              <ShieldCheck size={16} strokeWidth={2.5} />
              <span className="hidden md:inline">ADMIN</span>
            </BrutalistButton>
          </Tooltip>
        )}

        <Tooltip content="SETTINGS & BIOMES">
          <BrutalistButton
            variant="secondary"
            onClick={onOpenSettings}
          >
            <Sliders size={16} strokeWidth={2.5} />
          </BrutalistButton>
        </Tooltip>

        <Tooltip content="API TELEMETRY MONITOR">
          <BrutalistButton
            variant={isMonitorOpen ? 'accent' : 'subtle'}
            onClick={onToggleMonitor}
          >
            <Activity size={16} />
          </BrutalistButton>
        </Tooltip>
      </div>
    </BrutalistCard>
  );
}


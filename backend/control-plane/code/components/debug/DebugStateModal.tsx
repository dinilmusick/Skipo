'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  Search,
  Cpu,
  Layers,
  HardDrive,
  Sliders,
  Database,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { ThemeMode } from '../../lib/types';
import { FullFrontendUiState, filterDebugStateSection } from '../../lib/debug-ui-state';
import Tooltip from '../Tooltip';

interface DebugStateModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  state: FullFrontendUiState | null;
  onTriggerSync?: () => void;
}

type TabType = 'all' | 'nodegraph' | 'menus' | 'vault' | 'settings' | 'localstorage' | 'syncaudit';

export default function DebugStateModal({
  isOpen,
  onClose,
  theme,
  state,
  onTriggerSync,
}: DebugStateModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('syncaudit');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isDark = theme === 'dark';

  const tabData = useMemo(() => {
    if (!state) return null;
    return filterDebugStateSection(state, activeTab === 'all' ? undefined : activeTab);
  }, [state, activeTab]);

  const jsonString = useMemo(() => {
    if (!tabData) return '{}';
    return JSON.stringify(tabData, null, 2);
  }, [tabData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docustack-ui-state-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleManualSync = async () => {
    if (onTriggerSync) {
      setIsSyncing(true);
      onTriggerSync();
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  if (!isOpen) return null;

  const audit = state?.syncAudit;
  const is100Synced = audit?.isSynced && audit.syncScorePercent === 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono">
      <div
        className={`flex flex-col w-full max-w-5xl h-[88vh] border-3 shadow-[10px_10px_0px_#000000] ${
          isDark
            ? 'bg-[#1E1E24] text-[#F3EDE0] border-black'
            : 'bg-[#FAF6F0] text-[#21140E] border-[#2C1810]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b-3 border-black bg-black/30 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-[#D4AF37] text-black font-black text-xs border border-black shadow-[2px_2px_0px_#000000]">
              <Cpu size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wider text-[#D4AF37]">
                  UI STATE & SYNC DEBUGGER
                </span>
                <span className="text-[10px] bg-black/40 px-1.5 py-0.5 border border-black/50 text-[#D4AF37]/80">
                  CMD+SHIFT+D
                </span>
              </div>
              <p className="text-[10px] opacity-60">
                Live Frontend React State • LocalStorage Mirror • REST Relay Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync Badge */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase border-2 shadow-[2px_2px_0px_#000000] ${
                is100Synced
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500'
              }`}
            >
              {is100Synced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              <span>
                {is100Synced
                  ? '100% IN SYNC'
                  : `DRIFT: ${audit?.failedChecks || 0} MISMATCHES (${audit?.syncScorePercent || 0}%)`}
              </span>
            </div>

            {/* Quick Actions */}
            <Tooltip content="Trigger Immediate State Push to Backend">
              <button
                type="button"
                onClick={handleManualSync}
                className="flex items-center gap-1.5 px-2 py-1 text-xs border border-black bg-[#D4AF37] text-black font-bold hover:bg-[#c4a030] shadow-[2px_2px_0px_#000000]"
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                <span>SYNC NOW</span>
              </button>
            </Tooltip>

            <Tooltip content="Copy Visible JSON to Clipboard">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-black bg-black/20 hover:bg-black/40 shadow-[2px_2px_0px_#000000]"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </Tooltip>

            <Tooltip content="Download Full JSON Snapshot">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-black bg-black/20 hover:bg-black/40 shadow-[2px_2px_0px_#000000]"
              >
                <Download size={13} />
                <span>EXPORT</span>
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center border border-black bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white font-bold shadow-[2px_2px_0px_#000000]"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between border-b-2 border-black bg-black/20 px-3 py-1.5 gap-2">
          <div className="flex items-center gap-1">
            {[
              { id: 'syncaudit', label: 'SYNC AUDIT', icon: CheckCircle2 },
              { id: 'nodegraph', label: 'NODE GRAPH', icon: Layers },
              { id: 'menus', label: 'WORKSPACES & MENUS', icon: HardDrive },
              { id: 'vault', label: 'VAULT BROWSER', icon: Database },
              { id: 'settings', label: 'SETTINGS & PREFS', icon: Sliders },
              { id: 'localstorage', label: 'LOCALSTORAGE', icon: Database },
              { id: 'all', label: 'FULL JSON', icon: ExternalLink },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase transition-all border ${
                    isActive
                      ? 'border-black bg-[#D4AF37] text-black shadow-[2px_2px_0px_#000000]'
                      : 'border-transparent opacity-60 hover:opacity-100 hover:bg-black/20'
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Filter */}
          <div className="flex items-center gap-1 bg-black/30 border border-black px-2 py-0.5">
            <Search size={12} className="opacity-50" />
            <input
              type="text"
              placeholder="Filter JSON keys / values..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[11px] outline-none placeholder:opacity-40 w-48 font-mono text-[#F3EDE0]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="opacity-50 hover:opacity-100"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-3">
          {activeTab === 'syncaudit' ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Score Overview Card */}
              <div
                className={`p-3 border-2 shadow-[4px_4px_0px_#000000] ${
                  is100Synced
                    ? 'bg-emerald-500/10 border-emerald-500/60'
                    : 'bg-amber-500/10 border-amber-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm uppercase">
                      SYNCHRONIZATION INTEGRITY REPORT
                    </h3>
                    <p className="text-xs opacity-75 mt-0.5">
                      Cross-tier comparison: Frontend React State ↔ LocalStorage Snapshot ↔ Active
                      Workspace.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-2xl text-[#D4AF37]">
                      {audit?.syncScorePercent ?? 100}%
                    </span>
                    <span className="text-[10px] block opacity-60">
                      {audit?.passedChecks || 0} / {audit?.totalChecks || 0} CHECKS PASSED
                    </span>
                  </div>
                </div>

                {audit?.diffSummary && audit.diffSummary.length > 0 && (
                  <div className="mt-3 p-2 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs">
                    <div className="font-bold uppercase text-[10px] mb-1">
                      Detected Inconsistencies ({audit.diffSummary.length}):
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {audit.diffSummary.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Detailed Checks Table */}
              <div className="border-2 border-black bg-black/20">
                <div className="grid grid-cols-12 border-b border-black bg-black/40 p-2 text-[10px] font-black uppercase text-[#D4AF37]">
                  <span className="col-span-5">Verification Check</span>
                  <span className="col-span-2 text-center">Status</span>
                  <span className="col-span-2 text-right">UI Value</span>
                  <span className="col-span-3 text-right">Storage Value</span>
                </div>
                <div className="divide-y divide-black/20 text-xs">
                  {audit?.checks.map((c, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-12 p-2 items-center hover:bg-black/10 ${
                        !c.passed ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <div className="col-span-5 flex flex-col">
                        <span className="font-bold">{c.name}</span>
                        {c.diff && <span className="text-[10px] text-amber-400">{c.diff}</span>}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-black uppercase border ${
                            c.passed
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          {c.passed ? 'PASS' : 'DRIFT'}
                        </span>
                      </div>
                      <div className="col-span-2 text-right font-mono text-[11px] truncate opacity-90">
                        {String(c.uiValue)}
                      </div>
                      <div className="col-span-3 text-right font-mono text-[11px] truncate opacity-90">
                        {String(c.storageValue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* REST API & Automation Guide */}
              <div className="p-3 border border-black bg-black/30 text-xs space-y-1.5">
                <div className="font-black text-[#D4AF37] uppercase flex items-center gap-1.5">
                  <ExternalLink size={13} />
                  <span>PROGRAMMATIC ACCESS FOR SCRIPTS & CURL</span>
                </div>
                <p className="opacity-75 text-[11px]">
                  You can query or verify these UI states programmatically using either the
                  browser console or backend HTTP endpoints:
                </p>
                <div className="bg-black/50 p-2 border border-black text-[11px] text-emerald-300 space-y-1">
                  <div>
                    <span className="opacity-50"># In Browser Console:</span>
                    <br />
                    <code>window.DocuStackDebug.getNodeGraph()</code>
                  </div>
                  <div>
                    <span className="opacity-50"># Terminal / Automation Script:</span>
                    <br />
                    <code>curl -s http://localhost:3000/api/debug/ui-state?section=nodegraph</code>
                  </div>
                  <div>
                    <span className="opacity-50"># Full Sync Audit API:</span>
                    <br />
                    <code>curl -s http://localhost:3000/api/debug/sync-audit</code>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* JSON Viewer for Specific Section or Full State */
            <div className="flex-1 flex flex-col overflow-hidden border border-black bg-black/40">
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-black text-[10px] text-opacity-70">
                <span className="uppercase text-[#D4AF37] font-bold">
                  JSON VIEW: {activeTab.toUpperCase()}
                </span>
                <span>{jsonString.length} bytes</span>
              </div>
              <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono leading-relaxed select-text">
                <code>{jsonString}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t-2 border-black bg-black/20 px-3 py-2 text-[11px] opacity-75">
          <div>
            <span>Active Workspace: </span>
            <strong className="text-[#D4AF37]">
              {state?.menus?.activeWorkspace?.name || 'Default Vault'}
            </strong>{' '}
            <span className="opacity-50">({state?.menus?.activeWorkspace?.id})</span>
          </div>
          <div>
            <span>Nodes: </span>
            <strong>{state?.nodeGraph?.nodes?.length || 0}</strong> • <span>Edges: </span>
            <strong>{state?.nodeGraph?.edges?.length || 0}</strong> • <span>Documents: </span>
            <strong>{state?.vaultBrowser?.documents?.length || 0}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

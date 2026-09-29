/**
 * @file MainApp.tsx
 * @description Main application shell for MyApp.
 * Pre-wired with workspace selector, theme switching, and user session.
 * Compliant with Skipo Governance (< 200 lines).
 */

import React, { useEffect, useState } from 'react';
import { Layers, Database, HardDrive, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../frontend-state/appStore';
import { BaseButton } from '../../libraries/skipo/ui/components/base/BaseButton';
import { BaseBadge } from '../../libraries/skipo/ui/components/base/BaseBadge';
import { BaseCard } from '../../libraries/skipo/ui/components/base/BaseCard';
import { BottomStrip } from '../../libraries/skipo/ui/components/bottom-strip/BottomStrip';

import { apiClient } from '../../libraries/client/apiClient';

export const MainApp: React.FC = () => {
  const { user, activeWorkspace, workspaces, logout, setWorkspaces } = useAppStore();
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoadingWorkspaces(true);
      try {
        const data = await apiClient.getWorkspaces();
        if (data.success && Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces, data.activeWorkspaceId);
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      } finally {
        setLoadingWorkspaces(false);
      }
    }
    loadData();
  }, [setWorkspaces]);

  return (
    <div className="min-h-screen w-full bg-[var(--skipo-bg)] text-[var(--skipo-text)] flex flex-col font-mono select-none">
      {/* Top Navigation Bar */}
      <header className="h-12 border-b border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[var(--skipo-accent)] text-black font-black flex items-center justify-center border border-[var(--skipo-border-color)] text-xs">
            ▲
          </div>
          <span className="font-black text-sm tracking-wider uppercase">MyApp</span>
          <BaseBadge variant="default" size="sm">VITE + SKIPO</BaseBadge>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {activeWorkspace && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--skipo-border-color)] bg-[var(--skipo-bg)]">
              <HardDrive size={13} className="text-[var(--skipo-accent)]" />
              <span className="text-[var(--skipo-text-muted)]">Workspace:</span>
              <span className="font-bold text-[var(--skipo-text)]">{activeWorkspace.name}</span>
            </div>
          )}

          <div className="text-[var(--skipo-text-muted)]">
            User: <span className="font-bold text-[var(--skipo-text)]">{user?.username || user?.email || 'Authenticated'}</span>
          </div>

          <BaseButton variant="ghost" size="sm" onClick={logout} className="flex items-center gap-1 text-[var(--skipo-danger)]">
            <LogOut size={13} />
            <span>Sign Out</span>
          </BaseButton>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <BaseCard className="p-6 border-2 border-[var(--skipo-border-color)] bg-[var(--skipo-surface)]">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--skipo-border-color)] pb-3">
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-[var(--skipo-text)]">
                MyApp Scaffold Ready
              </h2>
              <p className="text-xs text-[var(--skipo-text-muted)] mt-1">
                All common systems (Authentication, Isomorphic Neon DB, Cloud Storage, Theming, Adapters) are pre-wired.
              </p>
            </div>
            <BaseBadge variant="success" size="md" className="flex items-center gap-1">
              <CheckCircle size={13} />
              <span>Plug & Play</span>
            </BaseBadge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 border border-[var(--skipo-border-color)] bg-[var(--skipo-bg)]">
              <div className="flex items-center gap-2 font-bold mb-1 text-[var(--skipo-accent)]">
                <Database size={14} />
                <span>Unified Neon DB</span>
              </div>
              <p className="text-[var(--skipo-text-muted)]">
                Zero-drift HTTP client running identically in Node.js and Cloudflare Workers.
              </p>
            </div>

            <div className="p-3 border border-[var(--skipo-border-color)] bg-[var(--skipo-bg)]">
              <div className="flex items-center gap-2 font-bold mb-1 text-[var(--skipo-accent)]">
                <HardDrive size={14} />
                <span>Cloud Storage</span>
              </div>
              <p className="text-[var(--skipo-text-muted)]">
                Pre-wired Backblaze B2 & Supabase connections via <code>storageCore.ts</code>.
              </p>
            </div>

            <div className="p-3 border border-[var(--skipo-border-color)] bg-[var(--skipo-bg)]">
              <div className="flex items-center gap-2 font-bold mb-1 text-[var(--skipo-accent)]">
                <Layers size={14} />
                <span>Multi-Target Build</span>
              </div>
              <p className="text-[var(--skipo-text-muted)]">
                Dual builds for Vercel/Node (<code>build:fullstack</code>) and Cloudflare Workers (<code>build:api</code>).
              </p>
            </div>
          </div>
        </BaseCard>

        {/* Feature Development Placeholder */}
        <section className="p-6 border border-dashed border-[var(--skipo-border-color)] text-center">
          <p className="text-sm font-bold text-[var(--skipo-text)] mb-1">
            Build Custom Feature Logic Here
          </p>
          <p className="text-xs text-[var(--skipo-text-muted)]">
            Run <code>python3 Skipo/scripts/rename_app.py "YourAppName"</code> to rename this application.
          </p>
        </section>
      </main>

      {/* Global Bottom Status Strip */}
      <BottomStrip />
    </div>
  );
};

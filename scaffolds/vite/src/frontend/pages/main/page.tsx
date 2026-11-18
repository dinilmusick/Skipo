'use client';

import { useState } from 'react';
import { BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainTabs from './MainTabs.js';
import SettingsPage from '../settings/page.js';

export interface MainPageProps {
  isGuest?: boolean;
  activeWorkspace?: WorkspaceRecord | null;
  onSwitchWorkspace?: () => void;
  onLogout?: () => void;
  currentUser?: { id: string; email: string; name?: string } | null;
}

/** The main-page shell is canonical; application UI is defined by tab modules only. */
export default function MainPage({ isGuest, activeWorkspace, currentUser, onSwitchWorkspace, onLogout }: MainPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div data-skipo-main-page="true" style={{ minHeight: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: 12 }}>
        {activeWorkspace && <span>{activeWorkspace.title}</span>}
        {onSwitchWorkspace && <BaseButton type="button" onClick={onSwitchWorkspace}>Switch workspace</BaseButton>}
        {onLogout && <BaseButton type="button" onClick={onLogout}>Sign out</BaseButton>}
        <BaseButton type="button" onClick={() => setShowSettings((value) => !value)}>
          {showSettings ? 'Back to workspace' : 'Settings'}
        </BaseButton>
      </header>
      <main>{showSettings ? <SettingsPage activeWorkspaceName={activeWorkspace?.title || (isGuest ? 'Guest' : undefined)} /> : <MainTabs activeWorkspace={activeWorkspace} isGuest={isGuest} currentUser={currentUser} onSwitchWorkspace={onSwitchWorkspace} onLogout={onLogout} />}</main>
    </div>
  );
}

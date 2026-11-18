'use client';

import React, { useState } from 'react';
import { BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainTabs from './MainTabs.js';
import SettingsPage from '../settings/page.js';

export interface MainPageProps {
  children?: React.ReactNode;
  isGuest?: boolean;
  activeWorkspace?: WorkspaceRecord | null;
  onSwitchWorkspace?: () => void;
}

/** Application-owned page content is supplied through children; no fake workspace is created. */
export default function MainPage({ children, isGuest, activeWorkspace, onSwitchWorkspace }: MainPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div data-skipo-main-page="true" style={{ minHeight: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: 12 }}>
        {activeWorkspace && <span>{activeWorkspace.title}</span>}
        {onSwitchWorkspace && <BaseButton type="button" onClick={onSwitchWorkspace}>Switch workspace</BaseButton>}
        <BaseButton type="button" onClick={() => setShowSettings((value) => !value)}>
          {showSettings ? 'Back to workspace' : 'Settings'}
        </BaseButton>
      </header>
      <main>{showSettings ? <SettingsPage activeWorkspaceName={activeWorkspace?.title || (isGuest ? 'Guest' : undefined)} /> : <MainTabs>{children}</MainTabs>}</main>
    </div>
  );
}

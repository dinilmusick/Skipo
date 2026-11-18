'use client';

import { useState, type ComponentProps } from 'react';
import { AppShell, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainTabs from './MainTabs.js';
import SettingsPage from '../settings/page.js';

export interface MainPageProps {
  isGuest?: boolean;
  activeWorkspace?: WorkspaceRecord | null;
  onSwitchWorkspace?: () => void;
  /**
   * Authorized agent directory and invocation adapter for the selected workspace.
   * The application supplies this from Kloks/Luth after permission filtering.
   * The managed Skipo shell never creates agents or imports Aiko runtime code.
   */
  agentChat?: ComponentProps<typeof AppShell>['agentChat'];
}

/** Managed Floks shell owns the footer; app UI belongs only to registered tabs. */
export default function MainPage({ isGuest, activeWorkspace, onSwitchWorkspace, agentChat }: MainPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const header = (
    <header style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: 12 }}>
      {activeWorkspace && <span>{activeWorkspace.title}</span>}
      {onSwitchWorkspace && <BaseButton type="button" onClick={onSwitchWorkspace}>Switch workspace</BaseButton>}
      <BaseButton type="button" onClick={() => setShowSettings((value) => !value)}>
        {showSettings ? 'Back to workspace' : 'Settings'}
      </BaseButton>
    </header>
  );
  return (
    <AppShell data-skipo-main-page="true" header={header}
      agentChat={!isGuest && activeWorkspace ? agentChat : undefined}>
      {showSettings
        ? <SettingsPage activeWorkspaceName={activeWorkspace?.title || (isGuest ? 'Guest' : undefined)} />
        : <MainTabs />}
    </AppShell>
  );
}

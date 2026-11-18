'use client';

import { useState } from 'react';
import { AppShell, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainTabs from './MainTabs.js';
import SettingsPage from '../settings/page.js';
import { bindAuthorizedAgentChat, type ScopedAgentChatHost } from './agentChatHost.js';

export interface MainPageProps {
  isGuest?: boolean;
  /** Luth authenticated principal, never a client-entered user ID. */
  principalId?: string;
  activeWorkspace?: WorkspaceRecord | null;
  onSwitchWorkspace?: () => void;
  /**
   * Authorized agent directory and invocation adapter for the selected workspace.
   * The application supplies this from Kloks/Luth after permission filtering.
   * The managed Skipo shell never creates agents or imports Aiko runtime code.
   */
  agentChat?: ScopedAgentChatHost;
}

/** Managed Floks shell owns the footer; app UI belongs only to registered tabs. */
export default function MainPage({ isGuest, principalId, activeWorkspace, onSwitchWorkspace, agentChat }: MainPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const scopedAgentChat = bindAuthorizedAgentChat(agentChat, {
    principalId, workspaceId: activeWorkspace?.id, isGuest,
  });
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
      agentChat={scopedAgentChat}>
      {showSettings
        ? <SettingsPage activeWorkspaceName={activeWorkspace?.title || (isGuest ? 'Guest' : undefined)} />
        : <MainTabs />}
    </AppShell>
  );
}

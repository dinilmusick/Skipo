'use client';

import { createElement, useState, type ComponentProps, type ComponentType } from 'react';
import { AppShell, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainTabs from './MainTabs.js';
import SettingsPage from '../settings/page.js';
import { bindAuthorizedAgentChat, type AgentChatBinding, type ScopedAgentChatHost } from './agentChatHost.js';
import { bindAuthorizedGraph, type ScopedGraphHost } from './universalGraphHost.js';

// The generated scaffold works with the pinned Floks layout type. The chat
// extension becomes active when the matching merged Floks release is installed.
// Casting does not make an old published AppShell implement the new runtime prop.
const UniversalAppShell = AppShell as ComponentType<ComponentProps<typeof AppShell> & {
  agentChat?: AgentChatBinding;
}>;

export interface MainPageProps {
  isGuest?: boolean;
  principalId?: string;
  activeWorkspace?: WorkspaceRecord | null;
  onSwitchWorkspace?: () => void;
  /** Authorized server-backed Luth/Kloks chat directory and invoker. */
  agentChat?: ScopedAgentChatHost;
  /** Floks remote graph with app-supplied Kloks-authorized runtime. */
  graph?: ScopedGraphHost;
}

/** Managed AppShell: opening a graph is navigation, never execution. */
export default function MainPage({isGuest, principalId, activeWorkspace, onSwitchWorkspace, agentChat, graph}: MainPageProps) {
  const [mode, setMode] = useState<'tabs' | 'graph' | 'settings'>('tabs');
  const context = {principalId, workspaceId: activeWorkspace?.id, isGuest};
  const authorizedChat = bindAuthorizedAgentChat(agentChat, context);
  const authorizedGraph = bindAuthorizedGraph(graph, context);
  const shownMode = mode === 'graph' && !authorizedGraph ? 'tabs' : mode;

  const header = (
    <header style={{display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', padding: 12}}>
      {activeWorkspace && <span>{activeWorkspace.title}</span>}
      {onSwitchWorkspace && <BaseButton type="button" onClick={onSwitchWorkspace}>Switch workspace</BaseButton>}
      {authorizedGraph && (
        <BaseButton type="button" onClick={() => setMode(current => current === 'graph' ? 'tabs' : 'graph')}>
          {shownMode === 'graph' ? 'Back to tabs' : 'Graph'}
        </BaseButton>
      )}
      <BaseButton type="button" onClick={() => setMode(current => current === 'settings' ? 'tabs' : 'settings')}>
        {shownMode === 'settings' ? 'Back to workspace' : 'Settings'}
      </BaseButton>
    </header>
  );

  return (
    <UniversalAppShell data-skipo-main-page="true" header={header} agentChat={authorizedChat}>
      {shownMode === 'settings'
        ? <SettingsPage activeWorkspaceName={activeWorkspace?.title || (isGuest ? 'Guest' : undefined)} />
        : shownMode === 'graph' && authorizedGraph
          ? createElement(authorizedGraph.GraphComponent, {
              key: authorizedGraph.scopeKey,
              scopeKey: authorizedGraph.scopeKey,
              workspaceId: activeWorkspace!.id,
              runtime: authorizedGraph.runtime,
              nodeDefinitions: authorizedGraph.nodeDefinitions ?? [],
            })
          : <MainTabs />}
    </UniversalAppShell>
  );
}

import { useState } from 'react';
import { mainPageTabs, MainTabContent, MainPageToolbar } from './tabRegistry.js';
import type { WorkspaceRecord } from '@ultrst-armada/floks/ui';

/** App-specific UI exists exclusively inside registered main-page tab modules. */
export default function MainTabs({ activeWorkspace, isGuest, currentUser, onSwitchWorkspace, onLogout }: { activeWorkspace?: WorkspaceRecord | null; isGuest?: boolean; currentUser?: { id: string; email: string; name?: string } | null; onSwitchWorkspace?: () => void; onLogout?: () => void }) {
  const [selected, select] = useState('');
  const activeTab = mainPageTabs.some(tab => tab.id === selected) ? selected : mainPageTabs[0]?.id;
  if (!activeTab) {
    return <main data-skipo-empty-tabs="true">Use skipo add main tab "Name" to create an application tab.</main>;
  }
  return <>
    <MainPageToolbar activeTabId={activeTab} onSelectTab={select} />
    <MainTabContent id={activeTab} activeWorkspace={activeWorkspace} isGuest={isGuest} currentUser={currentUser} onSwitchWorkspace={onSwitchWorkspace} onLogout={onLogout} />
  </>;
}

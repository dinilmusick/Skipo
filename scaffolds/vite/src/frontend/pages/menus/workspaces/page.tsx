'use client';

import { useState } from 'react';
import { BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { WorkspaceGate } from '../../../components/gates/WorkspaceGate.js';
import MainPage from '../../main/page.js';
import SettingsPage from '../../settings/page.js';

export interface WorkspacesPageProps {
  currentUser?: { id: string; email?: string; name?: string } | null;
  onSelectWorkspace?: (workspace: WorkspaceRecord) => void;
  onLogout?: () => void;
}

/** Compose the canonical Floks menu with Kloks data. Consumer content remains app-owned. */
export default function WorkspacesPage({ currentUser, onSelectWorkspace, onLogout }: WorkspacesPageProps) {
  const [selected, setSelected] = useState<WorkspaceRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (settingsOpen) return <section><BaseButton onClick={() => setSettingsOpen(false)}>Back to workspaces</BaseButton><SettingsPage /></section>;
  if (selected && !onSelectWorkspace) {
    return <MainPage activeWorkspace={selected} onSwitchWorkspace={() => setSelected(null)} />;
  }
  return (
    <WorkspaceGate
      currentUser={currentUser}
      onSelectWorkspace={(workspace) => {
        setSelected(workspace);
        onSelectWorkspace?.(workspace);
      }}
      onLogout={onLogout}
      onManageStorage={() => setSettingsOpen(true)}
    />
  );
}

'use client';

import { useState } from 'react';
import type { WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { WorkspaceGate } from '../../../components/gates/WorkspaceGate.js';
import MainPage from '../../main/page.js';

export interface WorkspacesPageProps {
  currentUser?: { id: string; email?: string; name?: string } | null;
  onSelectWorkspace?: (workspace: WorkspaceRecord) => void;
  onLogout?: () => void;
}

/** Compose the canonical Floks menu with Kloks data. Consumer content remains app-owned. */
export default function WorkspacesPage({ currentUser, onSelectWorkspace, onLogout }: WorkspacesPageProps) {
  const [selected, setSelected] = useState<WorkspaceRecord | null>(null);
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
    />
  );
}

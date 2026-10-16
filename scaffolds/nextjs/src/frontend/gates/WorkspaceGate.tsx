// @skipo:service kloks.service.storage
// @skipo:schema kloks.service.storage.ui@1.0.0
// @skipo:package @ultrst-armada/floks@^1.2.3
// @skipo:export ui
// @skipo:section Storage.ui.TilesSection
// @skipo:component WorkspaceTilesMenu
// @skipo:origin GENERATED
import React from 'react';
import { WorkspaceTilesMenu, type WorkspaceRecord } from '@ultrst-armada/floks/ui';

export interface WorkspaceGateProps {
  workspaces: WorkspaceRecord[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace: (ws: WorkspaceRecord) => void;
  onLogout?: () => void;
  appName?: string;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onLogout,
  appName = 'SKIPO APP',
}) => {
  return (
    <WorkspaceTilesMenu
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSelectWorkspace={onSelectWorkspace}
      onCreateWorkspace={async (input) => {
        await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      }}
      onLogout={onLogout}
      appName={appName}
      mode="working-workspace"
    />
  );
};

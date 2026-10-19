import React from 'react';
import { WorkspaceTilesMenu, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { apiClient } from '../../../libraries/client/apiClient.js';

export interface WorkspaceGateProps {
  workspaces: WorkspaceRecord[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace: (ws: WorkspaceRecord) => void;
  onCreateWorkspace?: (input: { name: string; workspacePath?: string; storageConfig?: any }) => Promise<void> | void;
  onDeleteWorkspace?: (id: string) => Promise<void> | void;
  onLogout?: () => void;
  appName?: string;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onLogout,
  appName = 'SKIPO APP',
}) => (
  <WorkspaceTilesMenu
    workspaces={workspaces}
    activeWorkspaceId={activeWorkspaceId}
    onSelectWorkspace={onSelectWorkspace}
    onCreateWorkspace={async (input) => {
      if (onCreateWorkspace) await onCreateWorkspace(input);
      else await apiClient.createWorkspace('system', input);
    }}
    onDeleteWorkspace={onDeleteWorkspace}
    onLogout={onLogout}
    appName={appName}
    mode="working-workspace"
  />
);

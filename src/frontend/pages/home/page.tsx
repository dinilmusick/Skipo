import { useState } from 'react';
import {
  frnlPage,
  BaseButton,
  BaseCard,
  WorkspaceTilesMenu,
  InfiniteCanvas,
  DockBar,
  type WorkspaceRecord,
} from '../../components/components.js';

export function HomePage() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([
    { id: 'ws-default', name: 'Primary Workspace', storageProvider: 'local_fs' },
  ]);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  if (!activeWorkspace) {
    return (
      <frnlPage appName="Skipo">
        <WorkspaceTilesMenu
          workspaces={workspaces}
          activeWorkspaceId={null}
          onSelectWorkspace={setActiveWorkspace}
          onCreateWorkspace={async (input) => {
            const name = input.name.trim();
            if (!name) throw new Error('Workspace name is required.');
            const created: WorkspaceRecord = {
              id: `ws-${Date.now()}`,
              name,
              description: input.description,
              storageProvider: input.storage?.provider ?? 'local_fs',
            };
            setWorkspaces((current) => [...current, created]);
            setActiveWorkspace(created);
          }}
        />
      </frnlPage>
    );
  }

  return (
    <frnlPage
      appName="Skipo"
      title={activeWorkspace.name}
      topBarActions={
        <BaseButton onClick={() => setActiveWorkspace(null)}>
          Switch Workspace
        </BaseButton>
      }
    >
      <BaseCard>
        <InfiniteCanvas
          items={[]}
          transform={canvasTransform}
          onTransformChange={setCanvasTransform}
        />
        <DockBar items={[]} />
      </BaseCard>
    </frnlPage>
  );
}

export default HomePage;

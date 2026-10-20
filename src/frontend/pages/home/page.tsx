import { useState } from 'react';
import {
  FrnlPage,
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
    { id: 'ws-default', title: 'Primary Workspace', storageProvider: 'local_fs' },
  ]);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  const dummyStorageService = {
    listBackblazeAccounts: async () => [],
    listBackblazeBuckets: async () => [],
  };

  if (!activeWorkspace) {
    return (
      <FrnlPage appName="Skipo">
        <WorkspaceTilesMenu
          workspaces={workspaces}
          userId="user-local"
          storageService={dummyStorageService}
          activeWorkspaceId={null}
          onSelectWorkspace={setActiveWorkspace}
          onCreateWorkspace={async (input) => {
            const title = input.name.trim();
            if (!title) throw new Error('Workspace name is required.');
            const created: WorkspaceRecord = {
              id: `ws-${Date.now()}`,
              title,
              description: input.description,
              storageProvider: input.storageProvider ?? 'local_fs',
            };
            setWorkspaces((current) => [...current, created]);
            setActiveWorkspace(created);
          }}
        />
      </FrnlPage>
    );
  }

  return (
    <FrnlPage
      appName="Skipo"
      title={activeWorkspace.title}
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
    </FrnlPage>
  );
}

export default HomePage;

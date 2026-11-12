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
import { LuthAuthPage } from '@ultrst-armada/floks/auth';
import { ModuleUIHost } from '../../components/module-ui/ModuleUIHost.js';

interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  username?: string;
}

export function HomePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [active, setActive] = useState<WorkspaceRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  if (!user) {
    return (
      <LuthAuthPage
        ecosystemId="ultrst-armada"
        applicationId="skipo"
        appName="Skipo"
        onAuthenticated={(authenticated) => setUser(authenticated as AuthenticatedUser)}
      />
    );
  }

  if (!active) {
    return (
      <FrnlPage appName="Skipo">
        <WorkspaceTilesMenu
          workspaces={workspaces}
          userId={user.id}
          activeWorkspaceId={null}
          onSelectWorkspace={setActive}
          onCreateWorkspace={async (input) => {
            const workspace: WorkspaceRecord = {
              id: `ws-${Date.now()}`,
              title: input.name.trim(),
              name: input.name.trim(),
              description: input.description,
              storageProvider: input.storageProvider,
              storageConnectionId: input.storageConnectionId,
            };
            setWorkspaces((current) => [...current, workspace]);
            setActive(workspace);
          }}
          onLogout={() => {
            setActive(null);
            setUser(null);
          }}
        />
      </FrnlPage>
    );
  }

  return (
    <FrnlPage
      appName="Skipo"
      title={active.title}
      topBarActions={<BaseButton onClick={() => setActive(null)}>Switch Workspace</BaseButton>}
    >
      <BaseCard>
        <InfiniteCanvas items={[]} transform={transform} onTransformChange={setTransform} />
        <DockBar items={[]} />
      </BaseCard>
      <ModuleUIHost />
    </FrnlPage>
  );
}

export default HomePage;

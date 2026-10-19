import { useState } from 'react';
import { defineFrnlComponent, useFrnlComponent } from '@dinilmusick/frnlts';
import {
  AppShell,
  TopToolbar,
  BottomStrip,
  BaseButton,
  BaseCard,
  WorkspaceTilesMenu,
  type WorkspaceRecord,
} from '@ultrst-armada/floks/ui';
import { InfiniteCanvas, DockBar } from '@ultrst-armada/floks/canvas-ui';
import { SkipoBackend } from '../backend/SkipoBackend.js';
import { skipoFrnlStore } from '../frontend-state/store.js';

const workspaceGateDefinition = defineFrnlComponent({
  name: 'SkipoWorkspaceGate',
  states: {
    default: {
      name: 'default',
      events: {},
      visualParameters: {},
      phases: {
        attackPhase: { visualDefinition: { parameters: {} } },
        sustainPhase: { visualDefinition: { parameters: {} } },
        releasePhase: { visualDefinition: { parameters: {} } },
      },
    },
  },
});

const applicationDefinition = defineFrnlComponent({
  name: 'SkipoApplication',
  states: {
    default: {
      name: 'default',
      events: {},
      visualParameters: {},
      phases: {
        attackPhase: { visualDefinition: { parameters: {} } },
        sustainPhase: { visualDefinition: { parameters: {} } },
        releasePhase: { visualDefinition: { parameters: {} } },
      },
    },
  },
});

function FrnlComponentBoundary({
  id,
  parentId,
  definition,
  children,
}: {
  id: string;
  parentId?: string;
  definition: typeof workspaceGateDefinition;
  children: React.ReactNode;
}) {
  useFrnlComponent({
    id,
    parentId,
    definition,
    store: skipoFrnlStore,
    handlers: {},
  });

  return <>{children}</>;
}

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([
    { id: 'ws-default', name: 'Primary Workspace', storageProvider: 'local_fs' },
  ]);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  if (!activeWorkspace) {
    return (
      <FrnlComponentBoundary
        id="skipo.workspaceGate"
        definition={workspaceGateDefinition}
      >
        <WorkspaceTilesMenu
          workspaces={workspaces}
          activeWorkspaceId={null}
          onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
          onCreateWorkspace={async (input: { name: string; description?: string; storage: any }) => {
            const validated = await SkipoBackend.services.workspace.execute<
              { id: string; name: string; storageType?: string },
              { workspaceId: string; name: string }
            >('validateWorkspaceConfig', {
              id: `ws-${Date.now()}`,
              name: input.name,
              storageType: input.storage?.provider,
            });
            const created: WorkspaceRecord = {
              id: validated.workspaceId,
              name: validated.name,
              storageProvider: input.storage?.provider,
            };
            setWorkspaces((prev) => [...prev, created]);
            setActiveWorkspace(created);
          }}
        />
      </FrnlComponentBoundary>
    );
  }

  return (
    <FrnlComponentBoundary
      id="skipo.application"
      definition={applicationDefinition}
    >
      <AppShell
        header={
          <TopToolbar
            title={activeWorkspace.name}
            actions={
              <BaseButton onClick={() => setActiveWorkspace(null)}>
                Switch Workspace
              </BaseButton>
            }
          />
        }
        footer={<BottomStrip centerSlot={<span>{activeWorkspace.name}</span>} />}
      >
        <BaseCard>
          <InfiniteCanvas
            items={[]}
            transform={canvasTransform}
            onTransformChange={setCanvasTransform}
          />
          <DockBar items={[]} />
        </BaseCard>
      </AppShell>
    </FrnlComponentBoundary>
  );
}

export default App;

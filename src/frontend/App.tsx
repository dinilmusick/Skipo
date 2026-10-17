import { useState } from 'react';
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
import { FrnlComposite, FrnlSlot } from '@dinilmusick/frnlts/react';
import { SkipoBackend } from '../backend/SkipoBackend.js';
import { skipoFrnlStore } from '../frontend-state/store.js';

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([
    { id: 'ws-default', name: 'Primary Workspace', storageProvider: 'local_fs' },
  ]);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  if (!activeWorkspace) {
    return (
      <FrnlComposite
        id="skipo.workspaceGate"
        store={skipoFrnlStore}
        slots={
          <FrnlSlot
            id="skipo.workspaceGate.menu"
            address="Skipo.workspaceGate.menu"
            occupantId="workspace-menu"
            occupantKind="composite"
            store={skipoFrnlStore}
          >
            <WorkspaceTilesMenu
              workspaces={workspaces}
              activeWorkspaceId={null}
              onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
              onCreateWorkspace={async (name, storage) => {
                const validated = await SkipoBackend.services.workspace.execute<
                  { id: string; name: string; storageType?: string },
                  { workspaceId: string; name: string }
                >('validateWorkspaceConfig', {
                  id: `ws-${Date.now()}`,
                  name,
                  storageType: storage.provider,
                });
                const created: WorkspaceRecord = {
                  id: validated.workspaceId,
                  name: validated.name,
                  storageProvider: storage.provider,
                };
                setWorkspaces((prev) => [...prev, created]);
                setActiveWorkspace(created);
              }}
            />
          </FrnlSlot>
        }
      />
    );
  }

  return (
    <FrnlComposite
      id="skipo.application"
      store={skipoFrnlStore}
      slots={
        <FrnlSlot
          id="skipo.application.shell"
          address="Skipo.application.shell"
          occupantId="app-shell"
          occupantKind="composite"
          store={skipoFrnlStore}
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
        </FrnlSlot>
      }
    />
  );
}

export default App;

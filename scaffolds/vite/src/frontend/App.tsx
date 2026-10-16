// ══════════════════════════════════════════════════════════════════════════════
// 1. MINIMAL FRONTEND COMPOSITION (@floks/* COMPOSITION)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { AppShell, TopToolbar, BottomStrip, BaseCard } from '@ultrst-armada/floks/ui';
import { InfiniteCanvas } from '@ultrst-armada/floks/canvas-ui';
import { LoginGate } from './gates/LoginGate';
import { WorkspaceGate } from './gates/WorkspaceGate';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([
    { id: 'ws-default', name: 'Primary Workspace', workspacePath: '/workspace' },
  ]);

  if (!token) {
    return <LoginGate appName="Skipo App" onSuccess={(res) => setToken(res.token || 'demo-token')} />;
  }

  if (!activeWorkspaceId) {
    return (
      <WorkspaceGate
        appName="Skipo App"
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={(ws) => setActiveWorkspaceId(ws.id)}
        onLogout={() => { setToken(null); setActiveWorkspaceId(null); }}
      />
    );
  }

  return (
    <AppShell
      header={<TopToolbar title="Skipo App" />}
      footer={<BottomStrip centerText="Skipo App" />}
    >
      <BaseCard>
        <InfiniteCanvas />
      </BaseCard>
    </AppShell>
  );
}

export default App;

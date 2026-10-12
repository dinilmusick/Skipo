// ══════════════════════════════════════════════════════════════════════════════
// 1. MINIMAL FRONTEND COMPOSITION (@floks/* COMPOSITION)
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { AppShell, TopToolbar, BottomStrip, BaseCard } from '@floks/ui';
import { InfiniteCanvas } from '@floks/canvas-ui';

export function App() {
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

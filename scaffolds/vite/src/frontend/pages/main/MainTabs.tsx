/// <reference types="vite/client" />
import { useState, type ReactNode } from 'react';
import { BaseButton } from '@ultrst-armada/floks/ui';

import { mainPageTabs, MainTabContent } from './tabRegistry.js';

export default function MainTabs({ children }: { children?: ReactNode }) {
  const [selected, select] = useState('');
  if (!mainPageTabs.length) return <>{children}</>;
  const active = mainPageTabs.some(tab => tab.id === selected);
  return <>
    <nav aria-label="Workspace views">
      <BaseButton type="button" aria-pressed={!active} onClick={() => select('')}>Overview</BaseButton>
      {mainPageTabs.map(tab => (
        <BaseButton key={tab.id} type="button" aria-pressed={selected === tab.id} onClick={() => select(tab.id)}>
          {tab.label}
        </BaseButton>
      ))}
    </nav>
    {active ? <MainTabContent id={selected} /> : children}
  </>;
}

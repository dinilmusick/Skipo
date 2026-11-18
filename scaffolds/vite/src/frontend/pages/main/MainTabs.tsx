/// <reference types="vite/client" />
import { useState, type ComponentType, type ReactNode } from 'react';
import { BaseButton } from '@ultrst-armada/floks/ui';

const modules = import.meta.glob<{ title: string; default: ComponentType }>(
  './tabs/*/page.tsx', { eager: true },
);
const tabs = Object.entries(modules).sort(([, a], [, b]) => a.title.localeCompare(b.title));

export default function MainTabs({ children }: { children?: ReactNode }) {
  const [selected, select] = useState('');
  if (!tabs.length) return <>{children}</>;
  const Active = modules[selected]?.default;
  return <>
    <nav aria-label="Workspace views">
      <BaseButton type="button" aria-pressed={!Active} onClick={() => select('')}>Overview</BaseButton>
      {tabs.map(([path, tab]) => (
        <BaseButton key={path} type="button" aria-pressed={selected === path} onClick={() => select(path)}>
          {tab.title}
        </BaseButton>
      ))}
    </nav>
    {Active ? <Active /> : children}
  </>;
}

/// <reference types="vite/client" />
import type { ComponentType, ComponentProps } from 'react';
import { TopToolbar } from '@ultrst-armada/floks/ui';

// A tab may be command-generated (name-hash) or app-owned (plain directory).
// Only page.tsx is an entrypoint; supporting code can live anywhere under tabs.
const modules = import.meta.glob<{ title?: string; default: ComponentType }>(
  './tabs/**/page.tsx', { eager: true },
);

function labelFor(path: string, title?: string): string {
  if (typeof title === 'string' && title.trim()) return title;
  const directory = path.split('/').slice(-2, -1)[0] ?? 'Tab';
  const friendly = directory.replace(/-[a-f0-9]{12}$/, '').replace(/[-_]+/g, ' ');
  return friendly.replace(/\b\w/g, character => character.toUpperCase());
}

export const mainPageTabs = Object.entries(modules)
  .filter(([, page]) => typeof page.default === 'function')
  .map(([path, page]) => ({
    id: 'skipo:' + path.slice('./tabs/'.length, -'/page.tsx'.length),
    label: labelFor(path, page.title),
    Page: page.default,
  }))
  .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));

export function MainTabContent({ id }: { id: string }) {
  const Page = mainPageTabs.find(tab => tab.id === id)?.Page;
  return Page ? <Page /> : null;
}

/** All app-specific content is registered as a main-page tab. */
export function MainPageToolbar({ tabs = [], ...props }: ComponentProps<typeof TopToolbar>) {
  return <TopToolbar {...props} tabs={[...tabs, ...mainPageTabs.map(({ id, label }) => ({ id, label }))]} />;
}

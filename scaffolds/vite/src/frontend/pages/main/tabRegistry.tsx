/// <reference types="vite/client" />
import type { ComponentType, ComponentProps } from 'react';
import { TopToolbar, type WorkspaceRecord } from '@ultrst-armada/floks/ui';

export interface SkipoTabRuntime {
  workspaceId?: string;
  activeWorkspace?: WorkspaceRecord | null;
  isGuest?: boolean;
}

// A tab may be command-generated (name-hash) or app-owned (plain directory).
// Only a direct child tab/page.tsx is registered. Nested support pages stay private
// to that tab and must not appear as unrelated top-level navigation tabs.
const modules = import.meta.glob<{ title?: string; default: ComponentType<SkipoTabRuntime> }>(
  './tabs/*/page.tsx', { eager: true },
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

/** Canonical authenticated workspace identity is passed to every app tab. */
export function MainTabContent({
  id, activeWorkspace, isGuest,
}: { id: string; activeWorkspace?: WorkspaceRecord | null; isGuest?: boolean }) {
  const Page = mainPageTabs.find(tab => tab.id === id)?.Page;
  return Page ? (
    <Page key={`${id}:${activeWorkspace?.id || (isGuest ? 'guest' : 'unselected')}`} workspaceId={activeWorkspace?.id} activeWorkspace={activeWorkspace} isGuest={isGuest} />
  ) : null;
}

/** All app-specific content is registered as a main-page tab. */
export function MainPageToolbar({ tabs = [], ...props }: ComponentProps<typeof TopToolbar>) {
  return <TopToolbar {...props} tabs={[...tabs, ...mainPageTabs.map(({ id, label }) => ({ id, label }))]} />;
}

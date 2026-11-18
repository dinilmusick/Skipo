/// <reference types="vite/client" />
import type { ComponentType, ComponentProps } from 'react';
import { TopToolbar } from '@ultrst-armada/floks/ui';

const modules = import.meta.glob<{ title: string; default: ComponentType }>(
  './tabs/*-????????????/page.tsx', { eager: true },
);

export const mainPageTabs = Object.entries(modules)
  .filter(([, page]) => typeof page.title === 'string' && typeof page.default === 'function')
  .map(([path, page]) => ({ id: 'skipo:' + path.split('/')[2], label: page.title, Page: page.default }))
  .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));

export function MainTabContent({ id }: { id: string }) {
  const Page = mainPageTabs.find(tab => tab.id === id)?.Page;
  return Page ? <Page /> : null;
}

/** All main pages expose built-in and command-created tabs in one flat toolbar. */
export function MainPageToolbar({ tabs = [], ...props }: ComponentProps<typeof TopToolbar>) {
  return <TopToolbar {...props} tabs={[...tabs, ...mainPageTabs.map(({ id, label }) => ({ id, label }))]} />;
}

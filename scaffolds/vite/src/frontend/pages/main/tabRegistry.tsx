/// <reference types="vite/client" />
import type { ComponentType } from 'react';

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

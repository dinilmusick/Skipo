/// <reference types="vite/client" />
import type { ComponentType } from 'react';

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

/* Preserve the existing public imports while each component owns one file. */
export { MainTabContent } from './MainTabContent.js';
export { MainPageToolbar } from './MainPageToolbar.js';

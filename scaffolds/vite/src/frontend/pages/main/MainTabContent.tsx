import { mainPageTabs } from './tabRegistry.js';

/** Render only the tab selected from the canonical, deterministic registry. */
export function MainTabContent({ id }: { id: string }) {
  const Page = mainPageTabs.find(tab => tab.id === id)?.Page;
  return Page ? <Page /> : null;
}

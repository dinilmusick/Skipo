import type { ComponentProps } from 'react';
import { TopToolbar } from '@ultrst-armada/floks/ui';
import { mainPageTabs } from './tabRegistry.js';

/** All app-specific content is registered as a main-page tab. */
export function MainPageToolbar({ tabs = [], ...props }: ComponentProps<typeof TopToolbar>) {
  return <TopToolbar {...props} tabs={[...tabs, ...mainPageTabs.map(({ id, label }) => ({ id, label }))]} />;
}

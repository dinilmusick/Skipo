import { useState, type ReactNode } from 'react';
import { mainPageTabs, MainTabContent, MainPageToolbar } from './tabRegistry.js';

export default function MainTabs({ children }: { children?: ReactNode }) {
  const [selected, select] = useState('overview');
  if (!mainPageTabs.length) return <>{children}</>;
  return <>
    <MainPageToolbar tabs={[{ id: 'overview', label: 'Overview' }]} activeTabId={selected} onSelectTab={select} />
    {selected === 'overview' ? children : <MainTabContent id={selected} />}
  </>;
}

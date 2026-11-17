'use client';

import type { ReactNode } from 'react';
import type { WorkspaceRecord } from '@ultrst-armada/floks/ui';
import MainPage from '../main/page.js';

/**
 * Application-owned home content extension. Identity and workspace lifecycle
 * are supplied by the canonical App -> Luth -> WorkspaceGate composition.
 * Never synthesize demo tokens or fallback workspaces in this page.
 */
export interface HomePageProps {
  children?: ReactNode;
  activeWorkspace?: WorkspaceRecord | null;
  isGuest?: boolean;
  onSwitchWorkspace?: () => void;
}

export function HomePage({ children, activeWorkspace, isGuest, onSwitchWorkspace }: HomePageProps) {
  return (
    <MainPage activeWorkspace={activeWorkspace} isGuest={isGuest} onSwitchWorkspace={onSwitchWorkspace}>
      {children}
    </MainPage>
  );
}

export default HomePage;

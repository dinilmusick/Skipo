'use client';

import type { WorkspaceRecord } from '../../components/components.js';
import MainPage from '../main/page.js';

/** Canonical home route: application code is mounted only through main tabs. */
export interface HomePageProps {
  activeWorkspace?: WorkspaceRecord | null;
  isGuest?: boolean;
  onSwitchWorkspace?: () => void;
}

export function HomePage({ activeWorkspace, isGuest, onSwitchWorkspace }: HomePageProps) {
  return <MainPage activeWorkspace={activeWorkspace} isGuest={isGuest} onSwitchWorkspace={onSwitchWorkspace} />;
}

export default HomePage;

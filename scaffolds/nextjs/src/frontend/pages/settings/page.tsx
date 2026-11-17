'use client';

import { ThemeSettingsSection } from '@ultrst-armada/floks/ui';
import AccountsTab from './tabs/accounts/page.js';

export default function SettingsPage({ activeWorkspaceName }: { activeWorkspaceName?: string }) {
  return (
    <section aria-label="Application settings">
      <h1>Settings</h1>
      {activeWorkspaceName && <p>Workspace: {activeWorkspaceName}</p>}
      <ThemeSettingsSection />
      <AccountsTab />
    </section>
  );
}

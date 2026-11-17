'use client';

import { useState } from 'react';
import { SkipoThemeProvider, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { LuthAuthPage, type UseLuthAuthResult } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import WorkspacesPage from './pages/menus/workspaces/page.js';
import { getSkipoApplicationId } from '../libraries/client/luthAuthClient.js';

function AuthenticatedApplication({ auth }: { auth: UseLuthAuthResult }) {
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  if (!workspace) {
    return (
      <WorkspacesPage
        currentUser={auth.user ? { id: auth.user.id, email: auth.user.email, name: auth.user.name } : null}
        onSelectWorkspace={setWorkspace}
        onLogout={() => { void auth.signOut(); }}
      />
    );
  }
  return <MainPage activeWorkspace={workspace} onSwitchWorkspace={() => setWorkspace(null)} />;
}

export function App() {
  const [isGuest, setIsGuest] = useState(false);
  return (
    <SkipoThemeProvider defaultTheme="dark">
      {isGuest ? <MainPage isGuest /> : (
        <LuthAuthPage
          ecosystemId="ultrst-armada"
          applicationId={getSkipoApplicationId()}
          appName="SKIPO APP"
          onContinueAsGuest={() => setIsGuest(true)}
          authenticatedContent={(auth) => <AuthenticatedApplication key={auth.user?.id} auth={auth} />}
        />
      )}
    </SkipoThemeProvider>
  );
}

export default App;

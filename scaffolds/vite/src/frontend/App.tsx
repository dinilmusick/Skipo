'use client';

import { useState } from 'react';
import { SkipoThemeProvider, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { LuthAuthPage, type UseLuthAuthResult } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import WorkspacesPage from './pages/menus/workspaces/page.js';
import { UiSessionControls } from './components/UiSessionControls.js';
import { getSkipoApplicationId, luthFetch } from '../libraries/client/luthAuthClient.js';

function AuthenticatedApplication({ auth }: { auth: UseLuthAuthResult }) {
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  return (
    <>
      <UiSessionControls request={luthFetch} />
      {!workspace ? (
      <WorkspacesPage
        currentUser={auth.user ? { id: auth.user.id, email: auth.user.email, name: auth.user.name } : null}
        onSelectWorkspace={setWorkspace}
        onLogout={() => { void auth.signOut(); }}
      />
      ) : <MainPage activeWorkspace={workspace} currentUser={auth.user ? { id: auth.user.id, email: auth.user.email, name: auth.user.name } : null} onSwitchWorkspace={() => setWorkspace(null)} onLogout={() => { void auth.signOut(); }} />}
    </>
  );
}

export function App() {
  const [isGuest, setIsGuest] = useState(false);
  return (
    <SkipoThemeProvider defaultTheme="dark">
      {isGuest ? <MainPage isGuest onLogout={() => setIsGuest(false)} /> : (
        <>
          <LuthAuthPage
            ecosystemId="ultrst-armada"
            applicationId={getSkipoApplicationId()}
            appName="SKIPO APP"
            authenticatedContent={(auth) => <AuthenticatedApplication auth={auth} />}
          />
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <BaseButton type="button" onClick={() => setIsGuest(true)}>Continue as guest</BaseButton>
          </div>
        </>
      )}
    </SkipoThemeProvider>
  );
}

export default App;

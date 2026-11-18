'use client';

import { useState } from 'react';
import { SkipoThemeProvider, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { LuthAuthPage, type UseLuthAuthResult } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import WorkspacesPage from './pages/menus/workspaces/page.js';
import { UiSessionControls } from './components/UiSessionControls.js';
import { getSkipoApplicationId, luthFetch } from '../libraries/client/luthAuthClient.js';

function AuthenticatedApplication({ auth }: { auth: UseLuthAuthResult }) {
  // Bind workspace selection to its authenticated principal. Rendering is
  // fail-closed immediately on a Luth identity switch, without waiting for effects.
  const [selection, setSelection] = useState<{ principalId: string; workspace: WorkspaceRecord } | null>(null);
  const principalId = auth.user?.id;
  const workspace = principalId && selection?.principalId === principalId ? selection.workspace : null;
  return (
    <>
      <UiSessionControls request={luthFetch} />
      {!workspace ? (
      <WorkspacesPage
        currentUser={auth.user ? { id: auth.user.id, email: auth.user.email, name: auth.user.name } : null}
        onSelectWorkspace={selected => { if (principalId) setSelection({ principalId, workspace: selected }); }}
        onLogout={() => { void auth.signOut(); }}
      />
      ) : <MainPage key={`${principalId}:${workspace.id}`} principalId={principalId} activeWorkspace={workspace}
        onSwitchWorkspace={() => setSelection(null)} />}
    </>
  );
}

export function App() {
  const [isGuest, setIsGuest] = useState(false);
  return (
    <SkipoThemeProvider defaultTheme="dark">
      {isGuest ? <MainPage isGuest /> : (
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

'use client';

import { useState } from 'react';
import { SkipoThemeProvider, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { LuthAuthPage, type UseLuthAuthResult } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import WorkspacesPage from './pages/menus/workspaces/page.js';
import { UiSessionControls } from './components/UiSessionControls.js';
import { getSkipoApplicationId, luthFetch } from '../libraries/client/luthAuthClient.js';
import type { ScopedUniversalUiHost } from './pages/main/universalGraphHost.js';
import { useAuthorizedUniversalUi } from './pages/main/useAuthorizedUniversalUi.js';

function AuthenticatedApplication({ auth, universalUi }: {
  auth: UseLuthAuthResult;
  universalUi?: ScopedUniversalUiHost;
}) {
  // Workspace selection belongs to the authenticated principal. A principal
  // switch drops the selection synchronously, without waiting for an effect.
  const [selection, setSelection] = useState<{principalId: string; workspace: WorkspaceRecord} | null>(null);
  const principalId = auth.user?.id;
  const workspace = principalId && selection?.principalId === principalId ? selection.workspace : null;
  const discoveredUi = useAuthorizedUniversalUi(principalId, workspace?.id, !universalUi);
  const activeUi = universalUi ?? discoveredUi;

  return (
    <>
      <UiSessionControls request={luthFetch} />
      {!workspace ? (
        <WorkspacesPage
          currentUser={auth.user ? {id: auth.user.id, email: auth.user.email, name: auth.user.name} : null}
          onSelectWorkspace={selected => { if (principalId) setSelection({principalId, workspace: selected}); }}
          onLogout={() => { setSelection(null); void auth.signOut(); }}
        />
      ) : (
        <MainPage principalId={principalId}
          activeWorkspace={workspace} agentChat={activeUi?.agentChat}
          graph={activeUi?.graph}
          onSwitchWorkspace={() => setSelection(null)} />
      )}
    </>
  );
}

/**
 * A generated app starts with no remote authority. It discovers an optional
 * authenticated application-owned Kloks host or accepts an explicit host.
 * Missing/invalid scopes fail closed; Skipo never fabricates an agent.
 */
export function App({universalUi}: {universalUi?: ScopedUniversalUiHost} = {}) {
  const [isGuest, setIsGuest] = useState(false);
  return (
    <SkipoThemeProvider defaultTheme="dark">
      {isGuest ? <MainPage isGuest /> : (
        <>
          <LuthAuthPage ecosystemId="ultrst-armada"
            applicationId={getSkipoApplicationId()}
            appName="SKIPO APP"
            authenticatedContent={auth => <AuthenticatedApplication auth={auth} universalUi={universalUi} />}
          />
          <div style={{display: 'flex', justifyContent: 'center', padding: 12}}>
            <BaseButton type="button" onClick={() => setIsGuest(true)}>Continue as guest</BaseButton>
          </div>
        </>
      )}
    </SkipoThemeProvider>
  );
}

export default App;

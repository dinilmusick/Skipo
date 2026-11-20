'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SkipoThemeProvider, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui';
import { LuthAuthPage, type UseLuthAuthResult } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import WorkspacesPage from './pages/menus/workspaces/page.js';
import { UiSessionControls } from './components/UiSessionControls.js';
import { getSkipoApplicationId, luthFetch } from '../libraries/client/luthAuthClient.js';
import * as KloksLuth from '@ultrst-armada/kloks/auth';
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

type InitPhase = 'discovery' | 'authentication' | 'configuring' | 'ready' | 'denied' | 'unavailable';

type BootstrapClient = {
  discover(): Promise<{ application: { appId: string } }>;
  configuration(): Promise<{ principal: { userId: string } }>;
  invalidate(): void;
};
type BootstrapFactory = (options: { appId: string }) => BootstrapClient;

/** Compatibility wrapper only: absent verified Kloks release fails closed. */
function createVerifiedInitializer(): BootstrapClient {
  const factory = (KloksLuth as unknown as {
    createApplicationUniversalInitializationClient?: BootstrapFactory;
  }).createApplicationUniversalInitializationClient;
  if (typeof factory !== 'function') {
    const unavailable = async (): Promise<never> => {
      throw new Error('UNIVERSAL_INITIALIZATION_CONTRACT_UNAVAILABLE');
    };
    return { discover: unavailable, configuration: unavailable, invalidate: () => {} };
  }
  // Public discovery uses the pinned Luth origin; protected config uses
  // only the same-origin HttpOnly Kloks BFF session, never browser bearer.
  return factory({ appId: getSkipoApplicationId() });
}



function InitializationGate({ children, phase, retry }: {
  children?: ReactNode; phase: InitPhase; retry: () => void;
}) {
  if (phase === 'ready' || phase === 'authentication') return <>{children}</>;
  const message = phase === 'discovery' ? 'Connecting to Luth discovery…'
    : phase === 'configuring' ? 'Verifying application configuration…'
    : phase === 'denied' ? 'Access to this application is denied.'
    : 'Luth discovery or configuration is unavailable.';
  return <div role="status" aria-live="polite" data-skipo-init={phase} style={{ padding: 24 }}>
    <p>{message}</p>
    {(phase === 'denied' || phase === 'unavailable')
      ? <button type="button" onClick={retry}>Retry initialization</button>
      : null}
  </div>;
}

/**
 * A single GutTS/Kloks client performs discovery and protected configuration.
 * The existing Floks Luth authentication screen remains the sole UI for login.
 * No application service can mount until its configuration is validated.
 */
function ConfiguredApplication({ auth, universalUi, initializer }: {
  auth: UseLuthAuthResult; universalUi?: ScopedUniversalUiHost;
  initializer: BootstrapClient;
}) {
  const [attempt, retry] = useState(0);
  const [phase, setPhase] = useState<InitPhase>('configuring');
  const principal = auth.user?.id;
  useEffect(() => {
    let active = true;
    setPhase('configuring');
    if (!principal) {
      setPhase('denied');
      return () => { active = false; };
    }
    void initializer.configuration().then(config => {
      if (!active) return;
      setPhase(config.principal.userId === principal ? 'ready' : 'denied');
    }).catch((error: unknown) => {
      if (!active) return;
      const code = (error as {code?: string})?.code;
      setPhase(code === 'AUTHORIZATION_DENIED' || code === 'APP_IDENTITY_UNVERIFIED'
        ? 'denied' : 'unavailable');
    });
    return () => { active = false; };
  }, [initializer, principal, attempt]);

  return <InitializationGate phase={phase} retry={() => {
    initializer.invalidate(); retry(n => n + 1);
  }}>
    {phase === 'ready'
      ? <AuthenticatedApplication auth={auth} universalUi={universalUi} />
      : null}
  </InitializationGate>;
}

/**
 * A generated app starts with no remote authority. It discovers an optional
 * authenticated application-owned Kloks host or accepts an explicit host.
 * Missing/invalid scopes fail closed; Skipo never fabricates an agent.
 */
export function App({universalUi}: {universalUi?: ScopedUniversalUiHost} = {}) {
  const [isGuest, setIsGuest] = useState(false);
  const [attempt, retry] = useState(0);
  const [phase, setPhase] = useState<InitPhase>('discovery');
  const initializer = useMemo(() => createVerifiedInitializer(), []);

  useEffect(() => {
    let active = true;
    setPhase('discovery');
    void initializer.discover().then(() => {
      if (active) setPhase('authentication');
    }).catch(error => {
      if (!active) return;
      setPhase((error as {code?: string})?.code === 'APP_NOT_FOUND' ||
        (error as {code?: string})?.code === 'UNTRUSTED_ISSUER' ? 'denied' : 'unavailable');
    });
    return () => { active = false; };
  }, [initializer, attempt]);

  return (
    <SkipoThemeProvider defaultTheme="dark">
      {isGuest ? <MainPage isGuest /> : (
        <>
          <InitializationGate phase={phase} retry={() => {
            initializer.invalidate(); retry(n => n + 1);
          }}>
            <LuthAuthPage ecosystemId="ultrst-armada"
              applicationId={getSkipoApplicationId()}
              appName="SKIPO APP"
              authenticatedContent={auth =>
                <ConfiguredApplication auth={auth}
                  universalUi={universalUi} initializer={initializer} />}
            />
          </InitializationGate>
          {/* Local-only guest mode must remain reachable during a Luth outage.
              Authenticated services remain behind the verified configuration gate. */}
          <div style={{display: 'flex', justifyContent: 'center', padding: 12}}>
            <BaseButton type="button" onClick={() => setIsGuest(true)}>Continue as guest</BaseButton>
          </div>
        </>
      )}
    </SkipoThemeProvider>
  );
}

export default App;

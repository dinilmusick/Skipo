'use client';

import { LuthAuthPage } from '@ultrst-armada/floks/auth';
import { AikoDirectChat } from './components/components.js';
import MainPage from './pages/main/page.js';
import { createAikoRuntime } from '../backend/AppBackend.js';
import { getSkipoApplicationId, luthAuthClient } from '../libraries/client/luthAuthClient.js';

const routes: Record<string, typeof MainPage> = { '/': MainPage, '/home': MainPage };

export function App() {
  const Page = routes[window.location.pathname] ?? MainPage;
  const workspaceId = localStorage.getItem('skipo-active-workspace') || 'default';
  const aikoRuntime = createAikoRuntime(workspaceId);
  const applicationId = getSkipoApplicationId();

  return (
    <LuthAuthPage
      ecosystemId="ultrst-armada"
      applicationId={applicationId}
      appName="SKIPO APP"
      authenticatedContent={
        <>
          <header style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
            <button type="button" onClick={() => { void luthAuthClient.signOut().then(() => window.location.assign('/login')); }}>Sign out</button>
          </header>
          <Page />
          <AikoDirectChat
            runtime={aikoRuntime}
            workspaceId={workspaceId}
            applicationId={applicationId}
          />
        </>
      }
    />
  );
}

export default App;

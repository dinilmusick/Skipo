'use client';

import { LuthAuthPage } from '@ultrst-armada/floks/auth';
import { AikoDirectChat } from './components/components.js';
import MainPage from './pages/main/page.js';
import { createAikoRuntime } from '../backend/AppBackend.js';
import { getSkipoApplicationId } from '../libraries/client/luthAuthClient.js';

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

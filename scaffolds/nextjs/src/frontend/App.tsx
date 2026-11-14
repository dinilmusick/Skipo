'use client';

import { useState } from 'react';
import { SkipoThemeProvider } from '@ultrst-armada/floks/ui';
import { LuthAuthPage } from '@ultrst-armada/floks/auth';
import MainPage from './pages/main/page.js';
import { getSkipoApplicationId, luthAuthClient } from '../libraries/client/luthAuthClient.js';

const routes: Record<string, typeof MainPage> = { '/': MainPage, '/home': MainPage };

async function acquireGuestSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/guest/session', { method: 'POST', headers: { 'content-type': 'application/json' } });
    const data = await res.json() as { success?: boolean; token?: string };
    return data.success && data.token ? data.token : null;
  } catch {
    return null;
  }
}

export function App() {
  const Page = routes[window.location.pathname] ?? MainPage;
  const applicationId = getSkipoApplicationId();
  const [guestToken, setGuestToken] = useState<string | null>(null);

  if (guestToken) {
    return (
      <SkipoThemeProvider defaultTheme="dark">
        <Page isGuest />
      </SkipoThemeProvider>
    );
  }

  return (
    <SkipoThemeProvider defaultTheme="dark">
      <LuthAuthPage
        ecosystemId="ultrst-armada"
        applicationId={applicationId}
        appName="SKIPO APP"
        onContinueAsGuest={async () => {
          const token = await acquireGuestSession();
          if (token) setGuestToken(token);
        }}
        authenticatedContent={
          <>
            <header style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
              <button type="button" onClick={() => { void luthAuthClient.signOut().then(() => window.location.assign('/login')); }}>Sign out</button>
            </header>
            <Page />
          </>
        }
      />
    </SkipoThemeProvider>
  );
}

export default App;

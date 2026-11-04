'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LuthAuthPage } from '@ultrst-armada/floks/auth';
import { SkipoThemeProvider } from '../../src/libraries/skipo/ui/theme/SkipoThemeProvider';
import { appThemeEngine } from '../../src/libraries/skipo/ui/theme/appSocket';

export default function LoginPage() {
  const router = useRouter();

  return (
    <SkipoThemeProvider engine={appThemeEngine}>
      <LuthAuthPage
        ecosystemId="ultrst-armada"
        applicationId="my-app"
        appName="MY APP"
        onAuthenticated={() => router.push('/')}
      />
    </SkipoThemeProvider>
  );
}

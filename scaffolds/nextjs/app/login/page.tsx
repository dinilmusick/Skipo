'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LuthAuthPage } from '../../src/frontend/pages/auth/LuthAuthPage';
import { getSkipoApplicationId } from '../../src/libraries/client/luthAuthClient';
import { SkipoThemeProvider } from '../../src/libraries/skipo/ui/theme/SkipoThemeProvider';
import { appThemeEngine } from '../../src/libraries/skipo/ui/theme/appSocket';

export default function LoginPage() {
  const router = useRouter();
  return (
    <SkipoThemeProvider engine={appThemeEngine}>
      <LuthAuthPage
        applicationId={getSkipoApplicationId()}
        appName="MY APP"
        onAuthenticated={() => router.push('/')}
      />
    </SkipoThemeProvider>
  );
}

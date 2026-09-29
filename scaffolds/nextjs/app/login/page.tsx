'use client';

// ══════════════════════════════════════════════════════════════════════════════
// DEDICATED LOGIN PAGE — SKIPO NEXT.JS SCAFFOLD (MyApp)
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useRouter } from 'next/navigation';
import { SkipoThemeProvider } from '../../src/libraries/skipo/ui/theme/SkipoThemeProvider';
import { appThemeEngine } from '../../src/libraries/skipo/ui/theme/appSocket';
import { UserAuthPage } from '../../src/frontend/components/auth/UserAuthPage/UserAuthPage';

export default function LoginPage() {
  const router = useRouter();

  return (
    <SkipoThemeProvider engine={appThemeEngine}>
      <UserAuthPage
        onLoginSuccess={() => {
          router.push('/');
        }}
      />
    </SkipoThemeProvider>
  );
}

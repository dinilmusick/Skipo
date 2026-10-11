'use client';

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT PAGE — SKIPO NEXT.JS SCAFFOLD (MyApp)
// Wraps the application in SkipoThemeProvider and handles auth gating.
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { SkipoThemeProvider } from '../src/libraries/skipo/ui/theme/SkipoThemeProvider';
import { appThemeEngine } from '../src/libraries/skipo/ui/theme/appSocket';
import { useAppStore } from '../src/frontend-state/appStore';
import { UserAuthPage } from '../src/frontend/components/auth/UserAuthPage/UserAuthPage';
import { MainApp } from '../src/frontend/components/MainApp';

export default function HomePage() {
  const { isAuthenticated } = useAppStore();

  return (
    <SkipoThemeProvider engine={appThemeEngine}>
      {isAuthenticated ? (
        <MainApp />
      ) : (
        <UserAuthPage />
      )}
    </SkipoThemeProvider>
  );
}

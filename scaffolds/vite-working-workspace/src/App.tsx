// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT — SKIPO SCAFFOLD (MyApp)
// Wraps the app in SkipoThemeProvider and handles auth gating.
// Agent fills MainApp with custom domain UI.
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { SkipoThemeProvider } from './libraries/skipo/ui/theme/SkipoThemeProvider';
import { appThemeEngine } from './libraries/skipo/ui/theme/appSocket';
import { useAppStore } from './frontend-state/appStore';
import { UserAuthPage } from './frontend/components/auth/UserAuthPage/UserAuthPage';
import { MainApp } from './frontend/components/MainApp';

export default function App() {
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

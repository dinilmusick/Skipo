// @skipo:service kloks.service.auth
// @skipo:schema kloks.service.auth.ui@1.0.0
// @skipo:package @ultrst-armada/floks@^1.2.3
// @skipo:export ui
// @skipo:section Auth.ui.LoginSection
// @skipo:component AuthPage
// @skipo:origin GENERATED
import React from 'react';
import { AuthPage, type AuthResult } from '@ultrst-armada/floks/ui';

export interface LoginGateProps {
  appName?: string;
  onSuccess: (result: AuthResult) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ appName = 'SKIPO APP', onSuccess }) => {
  return (
    <AuthPage
      appName={appName}
      appSubtitle="CANONICAL AUTH"
      footerText="Powered by @ultrst-armada/floks & @ultrst-armada/kloks"
      onLogin={async (email, password) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        return { success: Boolean(data.success && data.user), error: data.error, user: data.user, token: data.token };
      }}
      onRegister={async ({ name, email, password }) => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        return { success: Boolean(data.success && data.user), error: data.error, user: data.user, token: data.token };
      }}
      onSuccess={onSuccess}
    />
  );
};

import React from 'react';
import { AuthPage, type AuthResult } from '@ultrst-armada/floks/ui';
import { apiClient } from '../../../libraries/client/apiClient.js';

export interface LoginGateProps {
  appName?: string;
  onSuccess: (result: AuthResult) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ appName = 'SKIPO APP', onSuccess }) => (
  <AuthPage
    appName={appName}
    appSubtitle="CANONICAL AUTH"
    footerText="Powered by @ultrst-armada/floks & @ultrst-armada/kloks"
    onLogin={async (email, password) => {
      const data = await apiClient.login(email, password);
      return { success: Boolean(data?.success && data?.user), error: data?.error, user: data?.user, token: data?.token };
    }}
    onRegister={async ({ name, email, password }) => {
      const data = await apiClient.register({ name, email, password });
      return { success: Boolean(data?.success && data?.user), error: data?.error, user: data?.user, token: data?.token };
    }}
    onSuccess={onSuccess}
  />
);

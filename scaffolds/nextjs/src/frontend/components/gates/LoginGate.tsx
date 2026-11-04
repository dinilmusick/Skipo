import React from 'react';
import { AuthPage, type AuthResult } from '@ultrst-armada/floks/ui';
import { luthAuthClient } from '../../../libraries/client/luthAuthClient.js';

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
      await luthAuthClient.signInWithEmail({ email, password });
      const session = await luthAuthClient.getSession();
      return { success: session.authenticated, error: session.authenticated ? undefined : 'Luth session was not established.', user: session.user };
    }}
    onRegister={async ({ name, email, password }) => {
      await luthAuthClient.signUpWithEmail({ name, email, password });
      const session = await luthAuthClient.getSession();
      return { success: session.authenticated, error: session.authenticated ? undefined : 'Luth session was not established.', user: session.user };
    }}
    onGoogleSignIn={async () => {
      const result = await luthAuthClient.signInWithGoogle();
      const url = (result as { url?: string }).url;
      if (url) window.location.assign(url);
      return { success: Boolean(url), error: url ? undefined : 'Luth did not return a Google authorization URL.' };
    }}
    onSuccess={onSuccess}
  />
);

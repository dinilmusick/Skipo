'use client';

import React, { useEffect, useMemo } from 'react';
import { AuthPage, type AuthResult } from '@ultrst-armada/floks/auth';
import { createLuthAuthClient } from '@ultrst-armada/kloks/auth';

export interface LuthAuthPageProps {
  applicationId: string;
  appName: string;
  onAuthenticated?: (user: unknown) => void;
}

/** Floks owns presentation; Kloks supplies the client; Luth owns auth authority. */
export function LuthAuthPage({ applicationId, appName, onAuthenticated }: LuthAuthPageProps) {
  const client = useMemo(
    () => createLuthAuthClient({ ecosystemId: 'ultrst-armada', applicationId, autoRegister: true }),
    [applicationId],
  );

  useEffect(() => {
    let active = true;
    void client.getSession()
      .then((session) => {
        if (active && session.authenticated) onAuthenticated?.(session.user);
      })
      .catch(() => {
        // Keep the canonical sign-in UI available if session hydration is temporarily unavailable.
      });
    return () => { active = false; };
  }, [client, onAuthenticated]);

  const normalize = (value: unknown): AuthResult => {
    const payload = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
    const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, any>;
    const session = (payload.session && typeof payload.session === 'object' ? payload.session : {}) as Record<string, any>;
    return {
      success: true,
      user: payload.user ?? data.user,
      token: payload.token ?? session.token,
      redirectUrl: payload.url ?? payload.redirectURL ?? data.url,
    };
  };

  return (
    <AuthPage
      appName={appName}
      onLogin={async (email, password) => normalize(await client.signInWithEmail({ email, password }))}
      onRegister={async ({ name, email, password }) =>
        normalize(await client.signUpWithEmail({ name, email, password }))
      }
      onGoogleSignIn={async () => {
        const result = normalize(await client.signInWithGoogle({
          callbackURL: typeof window === 'undefined' ? undefined : window.location.origin,
        }));
        if (result.redirectUrl && typeof window !== 'undefined') window.location.assign(result.redirectUrl);
        return result;
      }}
      onSuccess={(result) => onAuthenticated?.(result.user)}
      enableGoogleSignIn
    />
  );
}

export default LuthAuthPage;

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuthOidcGate, type ApplicationOidcAuth, type AuthResult } from '@ultrst-armada/floks/auth';
import * as KloksLuth from '@ultrst-armada/kloks/auth';
import { getSkipoApplicationId } from '../../../libraries/client/luthAuthClient.js';

export interface LoginGateProps {
  appName?: string;
  /** Compatibility input; never accepted as an authority if it differs. */
  applicationId?: string;
  onSuccess: (result: AuthResult) => void;
}
type InitClient = {
  discover(): Promise<{ application: { appId: string } }>;
  configuration(): Promise<{ principal: { userId: string } }>;
  invalidate(): void;
};
type InitFactory = (options: { appId: string }) => InitClient;

function AuthorizedLogin({ auth, onSuccess }: {
  auth: ApplicationOidcAuth;
  onSuccess: (result: AuthResult) => void;
}) {
  const [status, setStatus] = useState<'checking' | 'denied' | 'unavailable'>('checking');
  const [attempt, setAttempt] = useState(0);
  const notified = useRef<string | null>(null);
  const client = useMemo(() => {
    const factory = (KloksLuth as unknown as {
      createApplicationUniversalInitializationClient?: InitFactory;
    }).createApplicationUniversalInitializationClient;
    return typeof factory === 'function'
      ? factory({ appId: getSkipoApplicationId() }) : null;
  }, []);
  const principalId = auth.user?.id;

  useEffect(() => {
    let active = true;
    setStatus('checking');
    if (!client || !principalId) {
      setStatus('unavailable');
      return () => { active = false; };
    }
    void (async () => {
      const discovery = await client.discover();
      if (discovery.application.appId !== getSkipoApplicationId()) {
        throw new Error('AUTHORIZATION_DENIED');
      }
      const config = await client.configuration();
      if (!active) return;
      if (config.principal.userId !== principalId) {
        setStatus('denied');
        return;
      }
      if (notified.current !== principalId) {
        notified.current = principalId;
        onSuccess({ success: true, user: auth.user });
      }
    })().catch((error: unknown) => {
      if (!active) return;
      const code = (error as {code?: string})?.code;
      setStatus(code === 'AUTHORIZATION_DENIED' ? 'denied' : 'unavailable');
    });
    return () => { active = false; };
  }, [client, principalId, attempt, onSuccess]);

  return <section role="status" aria-live="polite" data-skipo-login-config={status}>
    <p>{status === 'checking' ? 'Verifying Luth application configuration…' :
      status === 'denied' ? 'Application authorization denied.' :
      'Application configuration unavailable.'}</p>
    {status !== 'checking' && <button type="button" onClick={() => {
      client?.invalidate(); setAttempt(value => value + 1);
    }}>Retry initialization</button>}
  </section>;
}

/** Legacy LoginGate facade now enforces the same app-origin BFF as App. */
export const LoginGate: React.FC<LoginGateProps> = ({
  appName = 'SKIPO APP', applicationId, onSuccess,
}) => {
  if (applicationId !== undefined && applicationId !== getSkipoApplicationId()) {
    return <section role="alert">Unregistered application identity.</section>;
  }
  return <LuthOidcGate
    appName={appName}
    authenticatedContent={auth => <AuthorizedLogin auth={auth} onSuccess={onSuccess} />}
    onContinueAsGuest={() => onSuccess({ user: null, success: true })}
  />;
};

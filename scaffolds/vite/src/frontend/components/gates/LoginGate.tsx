'use client';

import React from 'react';
import { LuthOidcGate, type AuthResult } from '@ultrst-armada/floks/auth';

export interface LoginGateProps {
  appName?: string;
  applicationId?: string;
  onSuccess: (result: AuthResult) => void;
}

/** Thin presentation adapter; Kloks owns OAuth and the application session. */
export const LoginGate: React.FC<LoginGateProps> = ({
  appName = 'SKIPO APP',
  onSuccess,
}) => (
  <LuthOidcGate
    appName={appName}
    authenticatedContent={null}
    onAuthenticated={(user) => onSuccess({ user, success: true })}
    onContinueAsGuest={() => onSuccess({ user: null, success: true })}
  />
);

'use client';

import React from 'react';
import { LuthAuthPage, type AuthResult } from '@ultrst-armada/floks/auth';
import { getSkipoApplicationId } from '../../../libraries/client/luthAuthClient.js';
import { GuestAccessGate } from './GuestAccessGate.js';

export interface LoginGateProps {
  appName?: string;
  applicationId?: string;
  onSuccess: (result: AuthResult) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  appName = 'SKIPO APP',
  applicationId = getSkipoApplicationId(),
  onSuccess,
}) => (
  <div><LuthAuthPage
    ecosystemId="ultrst-armada"
    applicationId={applicationId}
    appName={appName}
    appSubtitle="CANONICAL AUTH"
    footerText="Powered by Luth · Floks · Kloks"
    onSuccess={onSuccess}
  /><GuestAccessGate onStarted={() => onSuccess({ user: null } as AuthResult)} /></div>
);

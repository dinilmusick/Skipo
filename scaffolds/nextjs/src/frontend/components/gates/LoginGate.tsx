import React from 'react';
import { LuthAuthPage, type AuthResult } from '@ultrst-armada/floks/auth';

export interface LoginGateProps {
  appName?: string;
  applicationId?: string;
  onSuccess: (result: AuthResult) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  appName = 'SKIPO APP',
  applicationId = 'skipo-app',
  onSuccess,
}) => (
  <LuthAuthPage
    ecosystemId="ultrst-armada"
    applicationId={applicationId}
    appName={appName}
    appSubtitle="CANONICAL AUTH"
    footerText="Powered by Luth · Floks · Kloks"
    onSuccess={onSuccess}
  />
);

'use client';

import React from 'react';
import { LuthAuthPage as FloksLuthAuthPage } from '@ultrst-armada/floks/auth';

export interface LuthAuthPageProps {
  applicationId: string;
  appName: string;
  onAuthenticated?: (user: unknown) => void;
}

/** Skipo supplies application identity; Floks owns the complete Luth auth lifecycle. */
export function LuthAuthPage({ applicationId, appName, onAuthenticated }: LuthAuthPageProps) {
  return (
    <FloksLuthAuthPage
      ecosystemId="ultrst-armada"
      applicationId={applicationId}
      appName={appName}
      onAuthenticated={onAuthenticated as any}
    />
  );
}

export default LuthAuthPage;

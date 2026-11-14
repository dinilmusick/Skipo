'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LuthAuthPage } from '../../src/frontend/pages/auth/LuthAuthPage';
import { getSkipoApplicationId } from '../../src/libraries/client/luthAuthClient';
import { GuestAccessGate } from '../../src/frontend/components/gates/GuestAccessGate';

export default function LoginPage() {
  const router = useRouter();
  return (
    <><LuthAuthPage
      applicationId={getSkipoApplicationId()}
      appName="MY APP"
      onAuthenticated={() => router.push('/')}
    /><GuestAccessGate onStarted={() => router.push('/')} /></>
  );
}

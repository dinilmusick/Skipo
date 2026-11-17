'use client';

import { useRouter } from 'next/navigation';
import { LuthAuthPage } from '../../src/frontend/pages/auth/LuthAuthPage';
import { getSkipoApplicationId } from '../../src/libraries/client/luthAuthClient';

export default function LoginClient() {
  const router = useRouter();
  return <LuthAuthPage
    applicationId={getSkipoApplicationId()}
    appName="MY APP"
    onAuthenticated={() => router.push('/')}
    onContinueAsGuest={() => router.push('/')}
  />;
}

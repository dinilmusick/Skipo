'use client';

import dynamic from 'next/dynamic';

// Browser-only auth depends on the runtime application origin.
const LoginClient = dynamic(() => import('../../src/frontend/pages/auth/LuthAuthPage')
  .then(mod => mod.LuthAuthPage), { ssr: false });

export default function LoginPage() {
  return <LoginClient applicationId="my-app" appName="MY APP" />;
}

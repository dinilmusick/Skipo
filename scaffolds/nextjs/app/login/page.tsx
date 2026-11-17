'use client';

import dynamic from 'next/dynamic';

// Keep the complete Luth login flow browser-only during static prerender.
const LoginClient = dynamic(() => import('./LoginClient'), { ssr: false });

export default function LoginPage() {
  return <LoginClient />;
}

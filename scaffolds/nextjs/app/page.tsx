'use client';

import dynamic from 'next/dynamic';

// Luth/Floks browser auth must not execute during server prerender.
const App = dynamic(() => import('../src/frontend/App'), { ssr: false });

export default function HomePage() {
  return <App />;
}

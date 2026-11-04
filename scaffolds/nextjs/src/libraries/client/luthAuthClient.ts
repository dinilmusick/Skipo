import { LuthAuthClient } from '@dinilmusick/gutts';

export const luthAuthClient = new LuthAuthClient({
  ecosystemId: process.env.NEXT_PUBLIC_LUTH_ECOSYSTEM_ID || 'ultrst-armada',
  applicationId: process.env.NEXT_PUBLIC_LUTH_APPLICATION_ID || 'skipo-app',
  luthUrl: process.env.NEXT_PUBLIC_LUTH_URL || 'https://luth.blueprint-ninjastudios.workers.dev',
  origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  autoRegister: true,
});

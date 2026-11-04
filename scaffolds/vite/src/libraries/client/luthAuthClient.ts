import { LuthAuthClient } from '@ultrst-armada/floks/ui';

const env = import.meta.env;

export const luthAuthClient = new LuthAuthClient({
  ecosystemId: env.VITE_LUTH_ECOSYSTEM_ID || 'ultrst-armada',
  applicationId: env.VITE_LUTH_APPLICATION_ID || window.location.hostname,
  luthUrl: env.VITE_LUTH_URL || 'https://luth.blueprint-ninjastudios.workers.dev',
  origin: window.location.origin,
  autoRegister: true,
});

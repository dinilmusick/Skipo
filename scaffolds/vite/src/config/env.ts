/** Canonical Skipo application environment. Provider credentials belong to canonical services. */
export interface AppEnv {
  SYSTEM_DATABASE_URL: string;
  SYSTEM_DATABASE_URL_2?: string;
  SYSTEM_DATABASE_URL_3?: string;
  APP_URL: string;
}

export function getAppEnv(): AppEnv {
  if (typeof process === 'undefined' || !process.env) {
    throw new Error('Skipo application environment requires server runtime configuration');
  }
  const SYSTEM_DATABASE_URL = process.env.SYSTEM_DATABASE_URL;
  const APP_URL = process.env.APP_URL;
  if (!SYSTEM_DATABASE_URL || !APP_URL) {
    throw new Error('Missing required Skipo application environment variables');
  }
  return {
    SYSTEM_DATABASE_URL,
    SYSTEM_DATABASE_URL_2: process.env.SYSTEM_DATABASE_URL_2,
    SYSTEM_DATABASE_URL_3: process.env.SYSTEM_DATABASE_URL_3,
    APP_URL,
  };
}

export { resolveSystemDatabaseUrl } from '@ultrst-armada/kloks/backend';
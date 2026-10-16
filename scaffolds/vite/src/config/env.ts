/**
 * @file env.ts
 * @description Typed environment access for MyApp.
 * Conforms to Skipo Governance (< 200 lines).
 */

export interface AppEnv {
  NODE_ENV: string;
  APP_URL?: string;
  GEMINI_API_KEY?: string;
  SYSTEM_DATABASE_URL_1?: string;
  SYSTEM_DATABASE_URL_2?: string;
  SYSTEM_DATABASE_URL_3?: string;
}

export function getAppEnv(): AppEnv {
  if (typeof process !== 'undefined' && process.env) {
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      APP_URL: process.env.APP_URL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SYSTEM_DATABASE_URL_1: process.env.SYSTEM_DATABASE_URL_1,
      SYSTEM_DATABASE_URL_2: process.env.SYSTEM_DATABASE_URL_2,
      SYSTEM_DATABASE_URL_3: process.env.SYSTEM_DATABASE_URL_3,
    };
  }
  return {
    NODE_ENV: 'development',
  };
}

export function resolveSystemDatabaseUrl(env: AppEnv = getAppEnv()): string {
  const url = env.SYSTEM_DATABASE_URL_1 || env.SYSTEM_DATABASE_URL_2 || env.SYSTEM_DATABASE_URL_3;
  if (!url) {
    throw new Error(
      '[SKIPO DATABASE_INVARIANT] Missing system database configuration.\n' +
      '  Set SYSTEM_DATABASE_URL_1 (primary), SYSTEM_DATABASE_URL_2 (fallback #1),\n' +
      '  or SYSTEM_DATABASE_URL_3 (fallback #2).\n' +
      '  Generic DATABASE_URL is obsolete and strictly forbidden in this architecture.'
    );
  }
  return url;
}

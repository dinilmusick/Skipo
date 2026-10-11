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
  DATABASE_URL?: string;
}

export function getAppEnv(): AppEnv {
  if (typeof process !== 'undefined' && process.env) {
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      APP_URL: process.env.APP_URL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SYSTEM_DATABASE_URL_1: process.env.SYSTEM_DATABASE_URL_1,
      DATABASE_URL: process.env.DATABASE_URL,
    };
  }
  return {
    NODE_ENV: 'development',
  };
}

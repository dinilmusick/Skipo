/**
 * @file database.ts
 * @description SQL & ORM Database Service Facade.
 * Conforms to APP_ARCHITECTURE_SPEC Sections 5, 18, 19, 20.
 */

import type { Runtime, Deployment } from '@skipo/backend';
import { databaseEngine } from './server/databaseEngine';

export const runtime: Runtime = 'server';
export const deployment: Deployment = 'local';

export const service = {
  name: 'database',
  runtime,
  deployment,
  query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
    return databaseEngine.execute<T>(sql, params);
  },
  transaction: async <T = unknown>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    return databaseEngine.transaction(fn);
  },
  isHealthy: async (): Promise<boolean> => {
    return databaseEngine.healthCheck();
  },
};

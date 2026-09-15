/**
 * @file index.ts
 * @description Dedicated SRKL Ecosystem Service Broker package exports for Skipo.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

export { SrklClient, createSrklClient } from './SrklClient';
export type {
  SrklServiceAccount,
  SrklClientOptions,
  SrklEcosystemQueryOptions,
  SrklEcosystemResponse,
  AppServiceDeclaration,
  AdaptedStorageConnection,
} from './types';

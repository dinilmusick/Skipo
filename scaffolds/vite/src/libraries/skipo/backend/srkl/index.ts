/**
 * @file index.ts
 * @description Dedicated SRKL Ecosystem Service Broker package exports.
 * Enables applications across the ecosystem to declare service dependencies,
 * connect to SRKL Vaults, and retrieve credentials.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

export { SrklClient, createSrklClient } from './SrklClient.js';
export { useSrklServices } from './useSrklServices.js';
export type { UseSrklServicesOptions, UseSrklServicesResult } from './useSrklServices.js';
export type {
  SrklServiceAccount,
  SrklClientOptions,
  SrklEcosystemQueryOptions,
  SrklEcosystemResponse,
  AppServiceDeclaration,
  AdaptedStorageConnection,
} from './types.js';

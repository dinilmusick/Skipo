/**
 * @file index.ts
 * @description Core Services barrel export (Zero-Drift Unified Core Services, Law L23)
 * Conforms to Skipo Governance (< 200 lines).
 */

export * from './unifiedDb';
export * from './authCore';
export * from './storageCore';
export * from './workspaceCore';

export const runtime: 'server' = 'server';
export const deployment: 'local' = 'local';

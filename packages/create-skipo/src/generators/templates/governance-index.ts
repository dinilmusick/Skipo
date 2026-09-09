/**
 * @fileoverview API Governance Barrel Export Template
 */

export const governanceIndexTemplate = () => `export * from './types';
export * from './rate-limiter';
export * from './abuse-detector';
export * from './resource-budget';
export * from './request-validator';
export * from './security-headers';
export * from './error-handler';
export * from './observability';
export * from './create-secure-route';
`;

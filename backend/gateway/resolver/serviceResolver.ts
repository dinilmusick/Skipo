/**
 * @file serviceResolver.ts
 * @description Resolves service requests to local implementations or remote endpoints.
 * Conforms to APP_ARCHITECTURE_SPEC Section 16 & < 200 lines.
 */

import { serviceRegistry } from '../registry/serviceRegistry';
import type { ServiceRegistryRecord } from '@skipo/backend';

export class ServiceResolver {
  public async resolve(serviceName: string): Promise<ServiceRegistryRecord | null> {
    const record = serviceRegistry.lookup(serviceName);
    if (!record) return null;
    return record;
  }
}

export const serviceResolver = new ServiceResolver();

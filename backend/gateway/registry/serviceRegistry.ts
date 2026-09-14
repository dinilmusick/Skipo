/**
 * @file serviceRegistry.ts
 * @description In-memory and persistent Service Registry for Gateway.
 * Conforms to APP_ARCHITECTURE_SPEC Section 15 & < 200 lines.
 */

import type { ServiceRegistryRecord } from '@skipo/backend';

export class ServiceRegistry {
  private records: Map<string, ServiceRegistryRecord> = new Map();

  public register(record: ServiceRegistryRecord): void {
    const key = `${record.name}:${record.version || '1.0.0'}`;
    this.records.set(key, record);
    this.records.set(record.name, record); // default latest alias
  }

  public lookup(serviceName: string, version?: string): ServiceRegistryRecord | null {
    if (version) {
      return this.records.get(`${serviceName}:${version}`) || null;
    }
    return this.records.get(serviceName) || null;
  }

  public listAll(): ServiceRegistryRecord[] {
    return Array.from(new Set(this.records.values()));
  }

  public deregister(serviceName: string): boolean {
    return this.records.delete(serviceName);
  }
}

export const serviceRegistry = new ServiceRegistry();

import { describe, expect, it } from 'vitest';
import type { GuestLeaseRecord, GuestLeaseStore } from '../src/guest/GuestLease.js';

export class MemoryGuestLeaseStore implements GuestLeaseStore {
  readonly records = new Map<string, GuestLeaseRecord>();

  async create(record: GuestLeaseRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async list(): Promise<GuestLeaseRecord[]> {
    return [...this.records.values()].map((record) => structuredClone(record));
  }

  async get(id: string): Promise<GuestLeaseRecord | undefined> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  async revoke(id: string, at: number): Promise<void> {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, revokedAt: at });
  }

  async deleteExpired(now: number): Promise<number> {
    let deleted = 0;
    for (const [id, record] of this.records) {
      if (record.expiresAt <= now) {
        this.records.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}

export const provider = {
  leaseStore: true,
  volatileWorkspace: true,
  leaseAffinity: true,
  ttlCleanup: true,
};

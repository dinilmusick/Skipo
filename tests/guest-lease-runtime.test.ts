import { describe, expect, it } from 'vitest';
import {
  assertGuestCapability,
  consumeGuestQuota,
  GuestLeaseManager,
  type GuestLeaseRecord,
  type GuestLeaseStore,
} from '../src/guest/GuestLease.js';

class MemoryGuestLeaseStore implements GuestLeaseStore {
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

const provider = {
  leaseStore: true,
  volatileWorkspace: true,
  leaseAffinity: true,
  ttlCleanup: true,
};

describe('GuestLeaseManager', () => {
  it('issues opaque credentials and never stores the raw credential', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store,
      provider,
      now: () => 1_000,
      minTtlMs: 100,
      maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });

    const result = await manager.issue({
      appId: 'app',
      deploymentId: 'deployment',
      workspaceId: 'workspace',
      ttlMs: 500,
      capabilities: ['workspace:read'],
    });

    const stored = await store.get(result.lease.id);
    expect(result.credential).toHaveLength(64);
    expect(stored?.credentialHash).not.toBe(result.credential);
    expect(stored?.credentialHash).toHaveLength(64);
  });

  it('binds authentication to app, deployment and workspace', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store,
      provider,
      now: () => 1_000,
      minTtlMs: 100,
      maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });
    const { credential, lease } = await manager.issue({
      appId: 'app',
      deploymentId: 'deployment',
      workspaceId: 'workspace',
      ttlMs: 500,
      capabilities: ['workspace:read'],
    });

    expect(
      await manager.authenticate({
        credential,
        appId: 'app',
        deploymentId: 'deployment',
        workspaceId: 'workspace',
      }),
    ).toMatchObject({ kind: 'guest', leaseId: lease.id });

    expect(
      await manager.authenticate({
        credential,
        appId: 'other-app',
        deploymentId: 'deployment',
        workspaceId: 'workspace',
      }),
    ).toBeNull();
  });

  it('expires, revokes and cleans up leases', async () => {
    let now = 1_000;
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store,
      provider,
      now: () => now,
      minTtlMs: 100,
      maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });
    const { credential, lease } = await manager.issue({
      appId: 'app',
      deploymentId: 'deployment',
      workspaceId: 'workspace',
      ttlMs: 100,
      capabilities: ['workspace:read'],
    });

    now = 1_050;
    expect(
      await manager.authenticate({
        credential,
        appId: 'app',
        deploymentId: 'deployment',
        workspaceId: 'workspace',
      }),
    ).not.toBeNull();

    await manager.revoke(lease.id);
    expect(
      await manager.authenticate({
        credential,
        appId: 'app',
        deploymentId: 'deployment',
        workspaceId: 'workspace',
      }),
    ).toBeNull();

    const second = await manager.issue({
      appId: 'app',
      deploymentId: 'deployment',
      workspaceId: 'workspace',
      ttlMs: 100,
      capabilities: ['workspace:read'],
    });
    now = second.lease.expiresAt;
    expect(await manager.cleanup()).toBe(1);
  });

  it('fails closed when a provider cannot guarantee guest portability', () => {
    expect(
      () =>
        new GuestLeaseManager({
          store: new MemoryGuestLeaseStore(),
          provider: { ...provider, leaseAffinity: false },
        }),
    ).toThrow(/leaseAffinity/);
  });

  it('defaults to deny and enforces capability and quota boundaries', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store,
      provider,
      now: () => 1_000,
      minTtlMs: 100,
      maxTtlMs: 1_000,
      maxBytes: 10,
      maxOperations: 2,
      enabledCapabilities: ['workspace:read'],
    });

    await expect(
      manager.issue({
        appId: 'app',
        deploymentId: 'deployment',
        workspaceId: 'workspace',
        ttlMs: 100,
        capabilities: ['runtime:invoke'],
      }),
    ).rejects.toThrow(/capability denied/);

    const { lease } = await manager.issue({
      appId: 'app',
      deploymentId: 'deployment',
      workspaceId: 'workspace',
      ttlMs: 100,
      capabilities: ['workspace:read'],
    });
    const principal = {
      kind: 'guest' as const,
      leaseId: lease.id,
      appId: lease.appId,
      deploymentId: lease.deploymentId,
      workspaceId: lease.workspaceId,
    };

    assertGuestCapability(principal, lease, 'workspace:read', 1_000);
    expect(() => assertGuestCapability(principal, lease, 'workspace:write', 1_000)).toThrow(
      /capability denied/,
    );

    consumeGuestQuota(lease, { bytes: 10, operations: 2 });
    expect(() => consumeGuestQuota(lease, { operations: 1 })).toThrow(/quota exceeded/);
  });
});

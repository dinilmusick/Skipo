import { describe, expect, it } from 'vitest';
import { assertGuestCapability, consumeGuestQuota, GuestLeaseManager } from '../src/guest/GuestLease.js';
import { MemoryGuestLeaseStore, provider } from './guest-lease-store.test.js';

describe('GuestLease security boundaries', () => {
  it('fails closed when a provider cannot guarantee guest portability', () => {
    expect(() => new GuestLeaseManager({
      store: new MemoryGuestLeaseStore(),
      provider: { ...provider, leaseAffinity: false },
    })).toThrow(/leaseAffinity/);
  });

  it('defaults to deny and enforces capability and quota boundaries', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store, provider, now: () => 1_000, minTtlMs: 100, maxTtlMs: 1_000,
      maxBytes: 10, maxOperations: 2, enabledCapabilities: ['workspace:read'],
    });

    await expect(manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 100, capabilities: ['runtime:invoke'],
    })).rejects.toThrow(/capability denied/);

    const { lease } = await manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 100, capabilities: ['workspace:read'],
    });
    const principal = {
      kind: 'guest' as const, leaseId: lease.id, appId: lease.appId,
      deploymentId: lease.deploymentId, workspaceId: lease.workspaceId,
    };

    assertGuestCapability(principal, lease, 'workspace:read', 1_000);
    expect(() => assertGuestCapability(
      principal, lease, 'workspace:write', 1_000,
    )).toThrow(/capability denied/);

    consumeGuestQuota(lease, { bytes: 10, operations: 2 });
    expect(() => consumeGuestQuota(lease, { operations: 1 })).toThrow(/quota exceeded/);
  });
});

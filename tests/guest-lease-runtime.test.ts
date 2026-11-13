import { describe, expect, it } from 'vitest';
import { GuestLeaseManager } from '../src/guest/GuestLease.js';
import { MemoryGuestLeaseStore, provider } from './guest-lease-store.test.js';

describe('GuestLeaseManager', () => {
  it('issues opaque credentials and never stores the raw credential', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store, provider, now: () => 1_000, minTtlMs: 100, maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });
    const result = await manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 500, capabilities: ['workspace:read'],
    });

    const stored = await store.get(result.lease.id);
    expect(result.credential).toHaveLength(64);
    expect(stored?.credentialHash).not.toBe(result.credential);
    expect(stored?.credentialHash).toHaveLength(64);
  });

  it('binds authentication to app, deployment and workspace', async () => {
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store, provider, now: () => 1_000, minTtlMs: 100, maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });
    const { credential, lease } = await manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 500, capabilities: ['workspace:read'],
    });

    expect(await manager.authenticate({
      credential, appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
    })).toMatchObject({ kind: 'guest', leaseId: lease.id });

    expect(await manager.authenticate({
      credential, appId: 'other-app', deploymentId: 'deployment', workspaceId: 'workspace',
    })).toBeNull();
  });

  it('expires, revokes and cleans up leases', async () => {
    let now = 1_000;
    const store = new MemoryGuestLeaseStore();
    const manager = new GuestLeaseManager({
      store, provider, now: () => now, minTtlMs: 100, maxTtlMs: 1_000,
      enabledCapabilities: ['workspace:read'],
    });
    const { credential, lease } = await manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 100, capabilities: ['workspace:read'],
    });

    now = 1_050;
    expect(await manager.authenticate({
      credential, appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
    })).not.toBeNull();

    await manager.revoke(lease.id);
    expect(await manager.authenticate({
      credential, appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
    })).toBeNull();

    const second = await manager.issue({
      appId: 'app', deploymentId: 'deployment', workspaceId: 'workspace',
      ttlMs: 100, capabilities: ['workspace:read'],
    });
    now = second.lease.expiresAt;
    expect(await manager.cleanup()).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { createGuestWorkspaceFactory } from '../src/guest/GuestWorkspaceFactory.js';
import type { GuestLeaseBinding, GuestWorkspaceStore } from '../src/guest/GuestWorkspace.js';

export interface GuestWorkspaceStorePair {
  first: GuestWorkspaceStore;
  second: GuestWorkspaceStore;
}

export type GuestWorkspaceStorePairFactory = () => GuestWorkspaceStorePair;

/**
 * Run this suite against two independent adapter instances backed by the same
 * deployment-shared volatile store. Do not pass the same adapter instance twice.
 */
export function defineGuestWorkspaceStoreConformance(
  adapterName: string,
  createPair: GuestWorkspaceStorePairFactory,
): void {
  describe(adapterName + ' GuestWorkspaceStore conformance', () => {
    const capabilities = { leaseAffinity: true, volatileWorkspace: true, ttlCleanup: true };
    const namespace = (id: string) => 'guest/conformance-app/conformance-deployment/' + id;
    const lease = (id: string, expiresAt = 2_000): GuestLeaseBinding => ({
      leaseId: id,
      appId: 'conformance-app',
      deploymentId: 'conformance-deployment',
      workspaceId: 'workspace-' + id,
      expiresAt,
    });

    it('preserves a lease namespace across reconstructed request providers', async () => {
      const stores = createPair();
      const binding = lease('restart');
      const first = await createGuestWorkspaceFactory({
        store: stores.first, capabilities, deployment: 'node', now: () => 1_000,
      }).createForLease(binding);
      await first.writeFile(binding, 'state.txt', 'survives reconstruction');
      const second = await createGuestWorkspaceFactory({
        store: stores.second, capabilities, deployment: 'node', now: () => 1_000,
      }).createForLease(binding);
      expect(await second.readText(binding, 'state.txt')).toBe('survives reconstruction');
    });

    it('fails closed when any required deployment capability is absent', () => {
      const store = createPair().first;
      const missing = [
        { ...capabilities, leaseAffinity: false },
        { ...capabilities, volatileWorkspace: false },
        { ...capabilities, ttlCleanup: false },
      ];
      for (const unsupported of missing) {
        expect(() => createGuestWorkspaceFactory({
          store, capabilities: unsupported, deployment: 'node',
        })).toThrow(/unsupported/);
      }
    });

    it('makes namespace creation idempotent and enforces shared lease capacity', async () => {
      const stores = createPair();
      const limits = { maxConcurrentLeases: 1 };
      await stores.first.createNamespace(namespace('same'), 2_000, limits);
      await stores.second.createNamespace(namespace('same'), 3_000, limits);
      await expect(stores.second.createNamespace(namespace('other'), 2_000, limits)).rejects.toThrow();
      await stores.first.write(namespace('same'), 'state.txt', new TextEncoder().encode('kept'), {
        maxBytes: 16, maxFiles: 1,
      });
      expect(new TextDecoder().decode(await stores.second.read(namespace('same'), 'state.txt'))).toBe('kept');
      expect(await stores.first.deleteExpired(2_500)).toBe(1);
      expect(await stores.second.read(namespace('same'), 'state.txt')).toBeUndefined();
    });

    it('atomically enforces live byte and file quotas across adapters', async () => {
      const stores = createPair();
      await stores.first.createNamespace(namespace('quota'), 2_000, { maxConcurrentLeases: 2 });
      const writes = await Promise.allSettled([
        stores.first.write(namespace('quota'), 'one.txt', new Uint8Array([1]), { maxBytes: 1, maxFiles: 1 }),
        stores.second.write(namespace('quota'), 'two.txt', new Uint8Array([2]), { maxBytes: 1, maxFiles: 1 }),
      ]);
      expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(writes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });

    it('atomically enforces operation and runtime budgets across adapters', async () => {
      const stores = createPair();
      await stores.first.createNamespace(namespace('budget'), 2_000, { maxConcurrentLeases: 2 });
      const operations = await Promise.allSettled([
        stores.first.consume(namespace('budget'), { operations: 1 }, { maxOperations: 1 }),
        stores.second.consume(namespace('budget'), { operations: 1 }, { maxOperations: 1 }),
      ]);
      expect(operations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const runtimeQuota = {
        maxRuntimeMemoryBytes: 8, maxRuntimeCpuMs: 10, maxRuntimeDurationMs: 10,
      };
      const runtime = await Promise.allSettled([
        stores.first.consumeRuntime(namespace('budget'), { memoryBytes: 4, cpuMs: 6, durationMs: 4 }, runtimeQuota),
        stores.second.consumeRuntime(namespace('budget'), { memoryBytes: 4, cpuMs: 6, durationMs: 4 }, runtimeQuota),
      ]);
      expect(runtime.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });

    it('isolates namespaces and reclaims only expired or explicitly deleted leases', async () => {
      const stores = createPair();
      await stores.first.createNamespace(namespace('lease-a'), 2_000, { maxConcurrentLeases: 3 });
      await stores.second.createNamespace(namespace('lease-b'), 1_500, { maxConcurrentLeases: 3 });
      await stores.first.write(namespace('lease-a'), 'private.txt', new TextEncoder().encode('a'), {
        maxBytes: 10, maxFiles: 1,
      });
      expect(await stores.second.read(namespace('lease-b'), 'private.txt')).toBeUndefined();
      expect(await stores.second.deleteNamespace(namespace('lease-a'))).toBe(true);
      expect(await stores.second.deleteNamespace(namespace('lease-a'))).toBe(false);
      expect(await stores.first.read(namespace('lease-b'), 'private.txt')).toBeUndefined();
      expect(await stores.first.deleteExpired(1_500)).toBe(1);
      expect(await stores.second.deleteExpired(1_500)).toBe(0);
    });
  });
}

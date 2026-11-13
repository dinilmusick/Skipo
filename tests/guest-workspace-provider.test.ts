import { describe, expect, it } from 'vitest';
import {
  GuestWorkspaceProvider,
  type GuestLeaseBinding,
  type GuestRuntimeUsage,
  type GuestWorkspaceEntry,
  type GuestWorkspaceQuotas,
  type GuestWorkspaceStore,
} from '../src/guest/GuestWorkspace.js';
import { createGuestWorkspaceFactory } from '../src/guest/GuestWorkspaceFactory.js';

class MemoryGuestWorkspaceStore implements GuestWorkspaceStore {
  readonly namespaces = new Map<string, Map<string, Uint8Array>>();
  readonly expiries = new Map<string, number>();
  readonly calls = { create: 0, read: 0, write: 0, delete: 0, mkdir: 0, list: 0, consume: 0, runtime: 0, destroy: 0, cleanup: 0 };
  readonly operations = new Map<string, number>();
  readonly runtime = new Map<string, GuestRuntimeUsage>();

  async createNamespace(namespace: string, expiresAt: number, limits: Pick<GuestWorkspaceQuotas, 'maxConcurrentLeases'>): Promise<void> {
    this.calls.create += 1;
    if (this.namespaces.has(namespace)) return; // Idempotent: never reset a live lease.
    if (this.namespaces.size >= limits.maxConcurrentLeases) throw new Error('Guest concurrent lease quota exceeded');
    this.namespaces.set(namespace, new Map());
    this.expiries.set(namespace, expiresAt);
  }
  async read(namespace: string, path: string): Promise<Uint8Array | undefined> {
    this.calls.read += 1;
    const value = this.namespaces.get(namespace)?.get(path);
    return value ? new Uint8Array(value) : undefined;
  }
  async write(namespace: string, path: string, data: Uint8Array, limits: Pick<GuestWorkspaceQuotas, 'maxBytes' | 'maxFiles'>): Promise<void> {
    this.calls.write += 1;
    const files = this.namespaces.get(namespace);
    if (!files) throw new Error('namespace missing');
    const existing = files.get(path);
    const currentFileEntries = [...files.entries()].filter(([name]) => !name.startsWith('.dir/'));
    const nextFileCount = currentFileEntries.length + (existing ? 0 : 1);
    const currentBytes = currentFileEntries.reduce((sum, [, value]) => sum + value.byteLength, 0);
    const nextBytes = currentBytes - (existing?.byteLength ?? 0) + data.byteLength;
    if (nextFileCount > limits.maxFiles) throw new Error('Guest file quota exceeded');
    if (nextBytes > limits.maxBytes) throw new Error('Guest byte quota exceeded');
    files.set(path, new Uint8Array(data));
  }
  async delete(namespace: string, path: string): Promise<boolean> {
    this.calls.delete += 1;
    return this.namespaces.get(namespace)?.delete(path) ?? false;
  }
  async mkdir(namespace: string, path: string): Promise<void> {
    this.calls.mkdir += 1;
    if (!this.namespaces.has(namespace)) throw new Error('namespace missing');
    this.namespaces.get(namespace)!.set(`.dir/${path}`, new Uint8Array());
  }
  async list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]> {
    this.calls.list += 1;
    const files = this.namespaces.get(namespace);
    if (!files) return [];
    return [...files.entries()]
      .filter(([path]) => !prefix || path === prefix || path.startsWith(`${prefix}/`))
      .map(([path, data]) => ({ path, name: path.split('/').pop() ?? path, sizeBytes: data.byteLength, updatedAt: 1_000, isFolder: path.startsWith('.dir/') }));
  }
  async consume(namespace: string, usage: { operations: number }, quota: Pick<GuestWorkspaceQuotas, 'maxOperations'>): Promise<void> {
    this.calls.consume += 1;
    const current = this.operations.get(namespace) ?? 0;
    if (current + usage.operations > quota.maxOperations) throw new Error('Guest operation quota exceeded');
    this.operations.set(namespace, current + usage.operations);
  }
  async consumeRuntime(
    namespace: string,
    usage: GuestRuntimeUsage,
    quota: Pick<GuestWorkspaceQuotas, 'maxRuntimeMemoryBytes' | 'maxRuntimeCpuMs' | 'maxRuntimeDurationMs'>,
  ): Promise<void> {
    this.calls.runtime += 1;
    const current = this.runtime.get(namespace) ?? { memoryBytes: 0, cpuMs: 0, durationMs: 0 };
    const next = { memoryBytes: Math.max(current.memoryBytes, usage.memoryBytes), cpuMs: current.cpuMs + usage.cpuMs, durationMs: current.durationMs + usage.durationMs };
    if (next.memoryBytes > quota.maxRuntimeMemoryBytes) throw new Error('Guest runtime memory quota exceeded');
    if (next.cpuMs > quota.maxRuntimeCpuMs) throw new Error('Guest runtime CPU quota exceeded');
    if (next.durationMs > quota.maxRuntimeDurationMs) throw new Error('Guest runtime duration quota exceeded');
    this.runtime.set(namespace, next);
  }
  async deleteNamespace(namespace: string): Promise<boolean> {
    this.calls.destroy += 1;
    this.expiries.delete(namespace);
    this.operations.delete(namespace);
    this.runtime.delete(namespace);
    return this.namespaces.delete(namespace);
  }
  async deleteExpired(now: number): Promise<number> {
    this.calls.cleanup += 1;
    const expired = [...this.expiries.entries()].filter(([, expiresAt]) => expiresAt <= now).map(([namespace]) => namespace);
    for (const namespace of expired) await this.deleteNamespace(namespace);
    return expired.length;
  }
}

const capabilities = { leaseAffinity: true, volatileWorkspace: true, ttlCleanup: true };
const lease = (id: string, expiresAt = 2_000): GuestLeaseBinding => ({
  leaseId: id, appId: 'app', deploymentId: 'deployment', workspaceId: `workspace-${id}`, expiresAt,
});

describe('GuestWorkspaceProvider', () => {
  it('factory allocates through the guest-only provider boundary', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const factory = createGuestWorkspaceFactory({ store, capabilities, deployment: 'cloudflare', now: () => 1_000 });
    const provider = await factory.createForLease(lease('factory'));
    await provider.writeFile(lease('factory'), 'a.txt', 'ok');
    expect(await provider.readText(lease('factory'), 'a.txt')).toBe('ok');
  });

  it('fails closed unless the deployment proves affinity, volatility and TTL cleanup', () => {
    expect(() => createGuestWorkspaceFactory({
      store: new MemoryGuestWorkspaceStore(), capabilities: { ...capabilities, leaseAffinity: false }, deployment: 'node',
    })).toThrow(/leaseAffinity/);
  });

  it('preserves workspace state when each request reconstructs its factory/provider', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const options = { store, capabilities, deployment: 'vercel' as const, now: () => 1_000 };
    const firstRequest = await createGuestWorkspaceFactory(options).createForLease(lease('stable'));
    await firstRequest.writeFile(lease('stable'), 'src/state.txt', 'survives request boundary');
    const secondRequest = await createGuestWorkspaceFactory(options).createForLease(lease('stable'));
    expect(await secondRequest.readText(lease('stable'), 'src/state.txt')).toBe('survives request boundary');
    expect(store.calls.create).toBe(2);
    expect(store.namespaces.size).toBe(1);
  });

  it('isolates concurrent leases and enforces the deployment-wide active lease limit', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const factory = createGuestWorkspaceFactory({
      store, capabilities, deployment: 'node', quotas: { maxConcurrentLeases: 2 }, now: () => 1_000,
    });
    const [one, two] = await Promise.all([factory.createForLease(lease('one')), factory.createForLease(lease('two'))]);
    await one.writeFile(lease('one'), 'same.txt', 'one');
    await two.writeFile(lease('two'), 'same.txt', 'two');
    expect(await one.readText(lease('one'), 'same.txt')).toBe('one');
    expect(await two.readText(lease('two'), 'same.txt')).toBe('two');
    await expect(factory.createForLease(lease('three'))).rejects.toThrow(/concurrent lease quota/);
  });

  it('uses the WorkspaceFS-shaped operation surface and keeps leases isolated', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({ store, capabilities, now: () => 1_000 });
    await provider.createWorkspace(lease('one'));
    await provider.createWorkspace(lease('two'));
    await provider.writeFile(lease('one'), 'src/a.txt', 'one');
    expect(await provider.exists(lease('one'), 'src/a.txt')).toBe(true);
    expect(await provider.readText(lease('one'), 'src/a.txt')).toBe('one');
    expect(await provider.exists(lease('two'), 'src/a.txt')).toBe(false);
    await expect(provider.readFile(lease('two'), 'src/a.txt')).rejects.toThrow(/not found/);
    await provider.mkdir(lease('one'), 'src');
    expect(store.namespaces.size).toBe(2);
  });

  it('rejects traversal and expired leases before touching the store', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({ store, capabilities, now: () => 1_000 });
    await provider.createWorkspace(lease('one'));
    const readsBefore = store.calls.read;
    await expect(provider.readFile(lease('one'), '../secret')).rejects.toThrow(/traversal/);
    await expect(provider.readFile(lease('one', 999), 'src/a.txt')).rejects.toThrow(/expired/);
    expect(store.calls.read).toBe(readsBefore);
  });

  it('enforces live byte and file-count quotas, including overwrite accounting', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({
      store, capabilities, quotas: { maxBytes: 3, maxFiles: 1 }, now: () => 1_000,
    });
    await provider.createWorkspace(lease('one'));
    await provider.writeFile(lease('one'), 'a.txt', 'abc');
    await provider.writeFile(lease('one'), 'a.txt', 'xy');
    await expect(provider.writeFile(lease('one'), 'b.txt', 'z')).rejects.toThrow(/file quota/);
    await expect(provider.writeFile(lease('one'), 'a.txt', 'long')).rejects.toThrow(/byte quota/);
    expect(await provider.readText(lease('one'), 'a.txt')).toBe('xy');
  });

  it('enforces operation quotas independently of workspace byte quotas', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({
      store, capabilities, quotas: { maxOperations: 1 }, now: () => 1_000,
    });
    await provider.createWorkspace(lease('one'));
    await provider.writeFile(lease('one'), 'a.txt', 'abc');
    await expect(provider.readFile(lease('one'), 'a.txt')).rejects.toThrow(/operation quota/);
    expect(store.calls.write).toBe(1);
  });

  it('enforces runtime memory, cumulative CPU and duration budgets', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({
      store, capabilities,
      quotas: { maxRuntimeMemoryBytes: 10, maxRuntimeCpuMs: 10, maxRuntimeDurationMs: 20 },
      now: () => 1_000,
    });
    await provider.createWorkspace(lease('one'));
    await provider.recordRuntimeUsage(lease('one'), { memoryBytes: 8, cpuMs: 4, durationMs: 5 });
    await provider.recordRuntimeUsage(lease('one'), { memoryBytes: 10, cpuMs: 3, durationMs: 5 });
    await expect(provider.recordRuntimeUsage(lease('one'), { memoryBytes: 11, cpuMs: 0, durationMs: 0 })).rejects.toThrow(/memory quota/);
    await expect(provider.recordRuntimeUsage(lease('one'), { memoryBytes: 1, cpuMs: 4, durationMs: 0 })).rejects.toThrow(/CPU quota/);
    await expect(provider.recordRuntimeUsage(lease('one'), { memoryBytes: 1, cpuMs: 0, durationMs: 11 })).rejects.toThrow(/duration quota/);
  });

  it('reclaims expired namespaces and rejects the expired lease before store access', async () => {
    const store = new MemoryGuestWorkspaceStore();
    let now = 1_000;
    const provider = new GuestWorkspaceProvider({ store, capabilities, now: () => now });
    await provider.createWorkspace(lease('short', 1_500));
    now = 1_500;
    await expect(provider.readFile(lease('short', 1_500), 'a.txt')).rejects.toThrow(/expired/);
    expect(await provider.cleanup()).toBe(1);
    expect(store.namespaces.size).toBe(0);
  });

  it('destroys only the exact lease namespace', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({ store, capabilities, now: () => 1_000 });
    await provider.createWorkspace(lease('one'));
    await provider.createWorkspace(lease('two'));
    expect(await provider.destroyWorkspace(lease('one'))).toBe(true);
    expect(store.namespaces.size).toBe(1);
    expect(await provider.exists(lease('two'), 'a.txt')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  GuestWorkspaceProvider,
  type GuestLeaseBinding,
  type GuestWorkspaceEntry,
  type GuestWorkspaceStore,
} from '../src/guest/GuestWorkspace.js';
import { createGuestWorkspaceFactory } from '../src/guest/GuestWorkspaceFactory.js';

class MemoryGuestWorkspaceStore implements GuestWorkspaceStore {
  readonly namespaces = new Map<string, Map<string, Uint8Array>>();
  readonly calls = { create: 0, read: 0, write: 0, delete: 0, mkdir: 0, list: 0, destroy: 0, cleanup: 0 };

  async createNamespace(namespace: string): Promise<void> { this.calls.create += 1; this.namespaces.set(namespace, new Map()); }
  async read(namespace: string, path: string): Promise<Uint8Array | undefined> { this.calls.read += 1; return this.namespaces.get(namespace)?.get(path); }
  async write(namespace: string, path: string, data: Uint8Array): Promise<void> {
    this.calls.write += 1;
    const files = this.namespaces.get(namespace);
    if (!files) throw new Error('namespace missing');
    files.set(path, new Uint8Array(data));
  }
  async delete(namespace: string, path: string): Promise<boolean> { this.calls.delete += 1; return this.namespaces.get(namespace)?.delete(path) ?? false; }
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
      .filter(([path]) => path === prefix || path.startsWith(`${prefix}/`))
      .map(([path, data]) => ({ path, name: path.split('/').pop() ?? path, sizeBytes: data.byteLength, updatedAt: 1_000, isFolder: path.startsWith('.dir/') }));
  }
  async deleteNamespace(namespace: string): Promise<boolean> { this.calls.destroy += 1; return this.namespaces.delete(namespace); }
  async deleteExpired(): Promise<number> { this.calls.cleanup += 1; return 0; }
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
    expect(() => new GuestWorkspaceProvider({
      store: new MemoryGuestWorkspaceStore(), capabilities: { ...capabilities, leaseAffinity: false },
    })).toThrow(/leaseAffinity/);
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

  it('enforces byte and operation quotas without persistent adapters', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({
      store, capabilities, quotas: { maxBytes: 3, maxOperations: 2 }, now: () => 1_000,
    });
    await provider.createWorkspace(lease('one'));
    await provider.writeFile(lease('one'), 'a.txt', 'abc');
    await expect(provider.writeFile(lease('one'), 'b.txt', 'd')).rejects.toThrow(/quota exceeded/);
    await expect(provider.readFile(lease('one'), 'missing')).rejects.toThrow(/quota exceeded/);
    expect(store.calls.write).toBe(1);
  });

  it('destroys namespaces and delegates only to the volatile store contract', async () => {
    const store = new MemoryGuestWorkspaceStore();
    const provider = new GuestWorkspaceProvider({ store, capabilities, now: () => 1_000 });
    await provider.createWorkspace(lease('one'));
    await provider.writeFile(lease('one'), 'a.txt', 'x');
    expect(await provider.destroyWorkspace(lease('one'))).toBe(true);
    expect(store.namespaces.size).toBe(0);
    expect(store.calls.destroy).toBe(1);
    expect(store.calls.cleanup).toBe(0);
  });
});

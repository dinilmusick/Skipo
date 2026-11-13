import { defineGuestWorkspaceStoreConformance } from './guest-workspace-store.conformance.js';
import type {
  GuestRuntimeUsage,
  GuestWorkspaceEntry,
  GuestWorkspaceQuotas,
  GuestWorkspaceStore,
} from '../src/guest/GuestWorkspace.js';

interface SharedBackend {
  namespaces: Map<string, Map<string, Uint8Array>>;
  expiries: Map<string, number>;
  operations: Map<string, number>;
  runtime: Map<string, GuestRuntimeUsage>;
}

class SharedVolatileStore implements GuestWorkspaceStore {
  constructor(private readonly backend: SharedBackend) {}

  async createNamespace(
    namespace: string,
    expiresAt: number,
    limits: Pick<GuestWorkspaceQuotas, 'maxConcurrentLeases'>,
  ): Promise<void> {
    if (this.backend.namespaces.has(namespace)) return;
    if (this.backend.namespaces.size >= limits.maxConcurrentLeases) {
      throw new Error('Guest concurrent lease quota exceeded');
    }
    this.backend.namespaces.set(namespace, new Map());
    this.backend.expiries.set(namespace, expiresAt);
  }

  async read(namespace: string, path: string): Promise<Uint8Array | undefined> {
    const value = this.backend.namespaces.get(namespace)?.get(path);
    return value ? new Uint8Array(value) : undefined;
  }

  async write(
    namespace: string,
    path: string,
    data: Uint8Array,
    limits: Pick<GuestWorkspaceQuotas, 'maxBytes' | 'maxFiles'>,
  ): Promise<void> {
    const files = this.backend.namespaces.get(namespace);
    if (!files) throw new Error('Guest namespace missing');
    const entries = Array.from(files.entries()).filter(([name]) => !name.startsWith('.dir/'));
    const previous = files.get(path);
    const count = entries.length + (previous ? 0 : 1);
    const bytes = entries.reduce((total, [, value]) => total + value.byteLength, 0);
    if (count > limits.maxFiles) throw new Error('Guest file quota exceeded');
    if (bytes - (previous?.byteLength ?? 0) + data.byteLength > limits.maxBytes) {
      throw new Error('Guest byte quota exceeded');
    }
    files.set(path, new Uint8Array(data));
  }

  async delete(namespace: string, path: string): Promise<boolean> {
    return this.backend.namespaces.get(namespace)?.delete(path) ?? false;
  }

  async mkdir(namespace: string, path: string): Promise<void> {
    const files = this.backend.namespaces.get(namespace);
    if (!files) throw new Error('Guest namespace missing');
    files.set('.dir/' + path, new Uint8Array());
  }

  async list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]> {
    const files = this.backend.namespaces.get(namespace);
    if (!files) return [];
    return Array.from(files.entries())
      .filter(([path]) => !prefix || path === prefix || path.startsWith(prefix + '/'))
      .map(([path, value]) => ({
        path,
        name: path.split('/').pop() ?? path,
        sizeBytes: value.byteLength,
        updatedAt: 1_000,
        isFolder: path.startsWith('.dir/'),
      }));
  }

  async consume(
    namespace: string,
    usage: { operations: number },
    quota: Pick<GuestWorkspaceQuotas, 'maxOperations'>,
  ): Promise<void> {
    if (!this.backend.namespaces.has(namespace)) throw new Error('Guest namespace missing');
    const next = (this.backend.operations.get(namespace) ?? 0) + usage.operations;
    if (next > quota.maxOperations) throw new Error('Guest operation quota exceeded');
    this.backend.operations.set(namespace, next);
  }

  async consumeRuntime(
    namespace: string,
    usage: GuestRuntimeUsage,
    quota: Pick<GuestWorkspaceQuotas, 'maxRuntimeMemoryBytes' | 'maxRuntimeCpuMs' | 'maxRuntimeDurationMs'>,
  ): Promise<void> {
    if (!this.backend.namespaces.has(namespace)) throw new Error('Guest namespace missing');
    const current = this.backend.runtime.get(namespace) ?? { memoryBytes: 0, cpuMs: 0, durationMs: 0 };
    const next = {
      memoryBytes: Math.max(current.memoryBytes, usage.memoryBytes),
      cpuMs: current.cpuMs + usage.cpuMs,
      durationMs: current.durationMs + usage.durationMs,
    };
    if (next.memoryBytes > quota.maxRuntimeMemoryBytes) throw new Error('Guest runtime memory quota exceeded');
    if (next.cpuMs > quota.maxRuntimeCpuMs) throw new Error('Guest runtime CPU quota exceeded');
    if (next.durationMs > quota.maxRuntimeDurationMs) throw new Error('Guest runtime duration quota exceeded');
    this.backend.runtime.set(namespace, next);
  }

  async deleteNamespace(namespace: string): Promise<boolean> {
    this.backend.expiries.delete(namespace);
    this.backend.operations.delete(namespace);
    this.backend.runtime.delete(namespace);
    return this.backend.namespaces.delete(namespace);
  }

  async deleteExpired(now: number): Promise<number> {
    const expired = Array.from(this.backend.expiries.entries())
      .filter(([, expiresAt]) => expiresAt <= now)
      .map(([namespace]) => namespace);
    for (const namespace of expired) await this.deleteNamespace(namespace);
    return expired.length;
  }
}

function createSharedPair(): { first: GuestWorkspaceStore; second: GuestWorkspaceStore } {
  const backend: SharedBackend = {
    namespaces: new Map(),
    expiries: new Map(),
    operations: new Map(),
    runtime: new Map(),
  };
  return {
    first: new SharedVolatileStore(backend),
    second: new SharedVolatileStore(backend),
  };
}

defineGuestWorkspaceStoreConformance('Shared volatile reference fixture', createSharedPair);

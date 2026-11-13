export interface GuestLeaseBinding {
  leaseId: string;
  appId: string;
  deploymentId: string;
  workspaceId: string;
  expiresAt: number;
}

export interface GuestWorkspaceCapabilities {
  /** The deployment can route every request for a lease to its shared volatile namespace. */
  leaseAffinity: boolean;
  /** Guest data is held only in volatile, non-persistent storage. */
  volatileWorkspace: boolean;
  /** The deployment has authoritative TTL cleanup independent of browser events. */
  ttlCleanup: boolean;
}

export interface GuestWorkspaceQuotas {
  maxBytes: number;
  maxFiles: number;
  maxOperations: number;
  maxConcurrentLeases: number;
  maxRuntimeMemoryBytes: number;
  maxRuntimeCpuMs: number;
  maxRuntimeDurationMs: number;
}

export interface GuestRuntimeUsage {
  memoryBytes: number;
  cpuMs: number;
  durationMs: number;
}

export interface GuestWorkspaceEntry {
  path: string;
  name: string;
  sizeBytes: number;
  updatedAt: number;
  isFolder: boolean;
}

export interface GuestWorkspaceStore {
  /** Atomically create-if-absent; repeated calls must preserve contents and expiry. */
  createNamespace(namespace: string, expiresAt: number, limits: Pick<GuestWorkspaceQuotas, 'maxConcurrentLeases'>): Promise<void>;
  read(namespace: string, path: string): Promise<Uint8Array | undefined>;
  /** Atomically enforce live byte/file limits; directory markers are not files. */
  write(namespace: string, path: string, data: Uint8Array, limits: Pick<GuestWorkspaceQuotas, 'maxBytes' | 'maxFiles'>): Promise<void>;
  delete(namespace: string, path: string): Promise<boolean>;
  mkdir(namespace: string, path: string): Promise<void>;
  list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]>;
  consume(namespace: string, usage: { operations: number }, quota: Pick<GuestWorkspaceQuotas, 'maxOperations'>): Promise<void>;
  /** Atomically enforce cumulative CPU/duration and current memory limits per lease. */
  consumeRuntime(namespace: string, usage: GuestRuntimeUsage, quota: Pick<GuestWorkspaceQuotas, 'maxRuntimeMemoryBytes' | 'maxRuntimeCpuMs' | 'maxRuntimeDurationMs'>): Promise<void>;
  deleteNamespace(namespace: string): Promise<boolean>;
  deleteExpired(now: number): Promise<number>;
}

export interface GuestWorkspaceProviderOptions {
  store: GuestWorkspaceStore;
  capabilities: GuestWorkspaceCapabilities;
  quotas?: Partial<GuestWorkspaceQuotas>;
  now?: () => number;
}

const DEFAULT_QUOTAS: GuestWorkspaceQuotas = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 500,
  maxOperations: 1_000,
  maxConcurrentLeases: 100,
  maxRuntimeMemoryBytes: 128 * 1024 * 1024,
  maxRuntimeCpuMs: 60_000,
  maxRuntimeDurationMs: 30 * 60 * 1_000,
};

function namespaceFor(lease: GuestLeaseBinding): string {
  return 'guest/' + encodeURIComponent(lease.appId) + '/' + encodeURIComponent(lease.deploymentId) + '/' +
    encodeURIComponent(lease.leaseId) + '/' + encodeURIComponent(lease.workspaceId);
}

function cleanPath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Guest workspace path must be relative and traversal-free');
  }
  return normalized;
}

function assertSupported(capabilities: GuestWorkspaceCapabilities): void {
  const missing = (['leaseAffinity', 'volatileWorkspace', 'ttlCleanup'] as const).filter((key) => !capabilities[key]);
  if (missing.length) throw new Error('Guest workspace unsupported: ' + missing.join(', '));
}

function assertPositiveQuotas(quotas: GuestWorkspaceQuotas): void {
  for (const [name, value] of Object.entries(quotas)) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Guest workspace quota ' + name + ' must be positive');
  }
}

export class GuestWorkspaceProvider {
  readonly type = 'guest-ephemeral' as const;
  private readonly quotas: GuestWorkspaceQuotas;
  private readonly now: () => number;

  constructor(private readonly options: GuestWorkspaceProviderOptions) {
    assertSupported(options.capabilities);
    this.quotas = { ...DEFAULT_QUOTAS, ...options.quotas };
    this.now = options.now ?? Date.now;
    assertPositiveQuotas(this.quotas);
  }

  async createWorkspace(lease: GuestLeaseBinding): Promise<{ id: string; expiresAt: number }> {
    const namespace = this.assertLease(lease);
    await this.options.store.createNamespace(namespace, lease.expiresAt, {
      maxConcurrentLeases: this.quotas.maxConcurrentLeases,
    });
    return { id: lease.workspaceId, expiresAt: lease.expiresAt };
  }

  async exists(lease: GuestLeaseBinding, filePath: string): Promise<boolean> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    return (await this.options.store.read(namespace, cleanPath(filePath))) !== undefined;
  }

  async stat(lease: GuestLeaseBinding, filePath: string): Promise<GuestWorkspaceEntry> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    const path = cleanPath(filePath);
    const exact = (await this.options.store.list(namespace, path)).find((entry) => entry.path === path);
    if (exact) return exact;
    const data = await this.options.store.read(namespace, path);
    if (!data) throw new Error('Guest workspace path not found');
    return { path, name: path.split('/').pop() ?? path, sizeBytes: data.byteLength, updatedAt: this.now(), isFolder: false };
  }

  async read(lease: GuestLeaseBinding, filePath: string): Promise<Uint8Array> {
    return this.readFile(lease, filePath);
  }

  async readText(lease: GuestLeaseBinding, filePath: string): Promise<string> {
    return new TextDecoder().decode(await this.readFile(lease, filePath));
  }

  async readFile(lease: GuestLeaseBinding, filePath: string): Promise<Uint8Array> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    const value = await this.options.store.read(namespace, cleanPath(filePath));
    if (!value) throw new Error('Guest workspace file not found');
    return value;
  }

  async writeFile(lease: GuestLeaseBinding, filePath: string, content: Uint8Array | string): Promise<{ success: true; path: string; sizeBytes: number }> {
    const namespace = this.assertLease(lease);
    const path = cleanPath(filePath);
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    await this.options.store.write(namespace, path, data, {
      maxBytes: this.quotas.maxBytes,
      maxFiles: this.quotas.maxFiles,
    });
    return { success: true, path, sizeBytes: data.byteLength };
  }

  async mkdir(lease: GuestLeaseBinding, directory: string): Promise<void> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    await this.options.store.mkdir(namespace, cleanPath(directory));
  }

  async deleteFile(lease: GuestLeaseBinding, filePath: string): Promise<{ success: boolean }> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    return { success: await this.options.store.delete(namespace, cleanPath(filePath)) };
  }

  async listFiles(lease: GuestLeaseBinding, prefix = ''): Promise<GuestWorkspaceEntry[]> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { operations: 1 }, this.quotas);
    return this.options.store.list(namespace, prefix ? cleanPath(prefix) : '');
  }

  async recordRuntimeUsage(lease: GuestLeaseBinding, usage: GuestRuntimeUsage): Promise<void> {
    const namespace = this.assertLease(lease);
    if (Object.values(usage).some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error('Guest runtime usage must be finite and non-negative');
    }
    await this.options.store.consumeRuntime(namespace, usage, {
      maxRuntimeMemoryBytes: this.quotas.maxRuntimeMemoryBytes,
      maxRuntimeCpuMs: this.quotas.maxRuntimeCpuMs,
      maxRuntimeDurationMs: this.quotas.maxRuntimeDurationMs,
    });
  }

  async destroyWorkspace(lease: GuestLeaseBinding): Promise<boolean> {
    const namespace = this.assertLease(lease);
    return this.options.store.deleteNamespace(namespace);
  }

  async cleanup(): Promise<number> {
    return this.options.store.deleteExpired(this.now());
  }

  private assertLease(lease: GuestLeaseBinding): string {
    if (!lease.leaseId || !lease.appId || !lease.deploymentId || !lease.workspaceId) {
      throw new Error('Guest workspace requires a complete lease binding');
    }
    if (lease.expiresAt <= this.now()) throw new Error('Guest workspace lease is expired');
    return namespaceFor(lease);
  }
}

export function createGuestWorkspaceProvider(options: GuestWorkspaceProviderOptions): GuestWorkspaceProvider {
  return new GuestWorkspaceProvider(options);
}

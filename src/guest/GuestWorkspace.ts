export interface GuestLeaseBinding {
  leaseId: string;
  appId: string;
  deploymentId: string;
  workspaceId: string;
  expiresAt: number;
}

export interface GuestWorkspaceCapabilities {
  leaseAffinity: boolean;
  volatileWorkspace: boolean;
  ttlCleanup: boolean;
}

export interface GuestWorkspaceQuotas {
  maxBytes: number;
  maxOperations: number;
}

export interface GuestWorkspaceEntry {
  path: string;
  name: string;
  sizeBytes: number;
  updatedAt: number;
  isFolder: boolean;
}

export interface GuestWorkspaceStore {
  createNamespace(namespace: string, expiresAt: number): Promise<void>;
  read(namespace: string, path: string): Promise<Uint8Array | undefined>;
  write(namespace: string, path: string, data: Uint8Array): Promise<void>;
  delete(namespace: string, path: string): Promise<boolean>;
  mkdir(namespace: string, path: string): Promise<void>;
  list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]>;
  consume(namespace: string, usage: { bytes: number; operations: number }, quota: GuestWorkspaceQuotas): Promise<void>;
  deleteNamespace(namespace: string): Promise<boolean>;
  deleteExpired(now: number): Promise<number>;
}

export interface GuestWorkspaceProviderOptions {
  store: GuestWorkspaceStore;
  capabilities: GuestWorkspaceCapabilities;
  quotas?: Partial<GuestWorkspaceQuotas>;
  now?: () => number;
}

const DEFAULT_QUOTAS: GuestWorkspaceQuotas = { maxBytes: 10 * 1024 * 1024, maxOperations: 1_000 };

function namespaceFor(lease: GuestLeaseBinding): string {
  return `guest/${encodeURIComponent(lease.appId)}/${encodeURIComponent(lease.deploymentId)}/${encodeURIComponent(lease.leaseId)}/${encodeURIComponent(lease.workspaceId)}`;
}

function cleanPath(path: string): string {
  const normalized = path.replaceAll('\\\\', '/').replace(/^\\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Guest workspace path must be relative and traversal-free');
  }
  return normalized;
}

function assertSupported(capabilities: GuestWorkspaceCapabilities): void {
  const missing = (['leaseAffinity', 'volatileWorkspace', 'ttlCleanup'] as const).filter((key) => !capabilities[key]);
  if (missing.length) throw new Error(`Guest workspace unsupported: ${missing.join(', ')}`);
}

export class GuestWorkspaceProvider {
  readonly type = 'guest-ephemeral' as const;
  private readonly quotas: GuestWorkspaceQuotas;
  private readonly now: () => number;

  constructor(private readonly options: GuestWorkspaceProviderOptions) {
    assertSupported(options.capabilities);
    this.quotas = { ...DEFAULT_QUOTAS, ...options.quotas };
    this.now = options.now ?? Date.now;
    if (this.quotas.maxBytes <= 0 || this.quotas.maxOperations <= 0) throw new Error('Guest workspace quotas must be positive');
  }

  async createWorkspace(lease: GuestLeaseBinding): Promise<{ id: string; expiresAt: number }> {
    this.assertLease(lease);
    await this.options.store.createNamespace(namespaceFor(lease), lease.expiresAt);
    return { id: lease.workspaceId, expiresAt: lease.expiresAt };
  }

  async exists(lease: GuestLeaseBinding, filePath: string): Promise<boolean> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
    return (await this.options.store.read(namespace, cleanPath(filePath))) !== undefined;
  }

  async stat(lease: GuestLeaseBinding, filePath: string): Promise<GuestWorkspaceEntry> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
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
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
    const value = await this.options.store.read(namespace, cleanPath(filePath));
    if (!value) throw new Error('Guest workspace file not found');
    return value;
  }

  async writeFile(lease: GuestLeaseBinding, filePath: string, content: Uint8Array | string): Promise<{ success: true; path: string; sizeBytes: number }> {
    const namespace = this.assertLease(lease);
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    await this.options.store.consume(namespace, { bytes: data.byteLength, operations: 1 }, this.quotas);
    await this.options.store.write(namespace, cleanPath(filePath), data);
    return { success: true, path: filePath, sizeBytes: data.byteLength };
  }

  async mkdir(lease: GuestLeaseBinding, directory: string): Promise<void> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
    await this.options.store.mkdir(namespace, cleanPath(directory));
  }

  async deleteFile(lease: GuestLeaseBinding, filePath: string): Promise<{ success: boolean }> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
    return { success: await this.options.store.delete(namespace, cleanPath(filePath)) };
  }

  async listFiles(lease: GuestLeaseBinding, prefix = ''): Promise<GuestWorkspaceEntry[]> {
    const namespace = this.assertLease(lease);
    await this.options.store.consume(namespace, { bytes: 0, operations: 1 }, this.quotas);
    return this.options.store.list(namespace, prefix ? cleanPath(prefix) : '');
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

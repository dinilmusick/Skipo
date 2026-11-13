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
  list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]>;
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
  maxOperations: 1_000,
};

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
  const missing = (['leaseAffinity', 'volatileWorkspace', 'ttlCleanup'] as const)
    .filter((key) => !capabilities[key]);
  if (missing.length) {
    throw new Error(`Guest workspace unsupported: ${missing.join(', ')}`);
  }
}

export class GuestWorkspaceProvider {
  readonly type = 'guest-ephemeral' as const;
  private readonly quotas: GuestWorkspaceQuotas;
  private readonly now: () => number;
  private readonly usage = new Map<string, { bytes: number; operations: number }>();

  constructor(private readonly options: GuestWorkspaceProviderOptions) {
    assertSupported(options.capabilities);
    this.quotas = { ...DEFAULT_QUOTAS, ...options.quotas };
    this.now = options.now ?? Date.now;
    if (this.quotas.maxBytes <= 0 || this.quotas.maxOperations <= 0) {
      throw new Error('Guest workspace quotas must be positive');
    }
  }

  async createWorkspace(lease: GuestLeaseBinding): Promise<{ id: string; expiresAt: number }> {
    this.assertLease(lease);
    const namespace = namespaceFor(lease);
    await this.options.store.createNamespace(namespace, lease.expiresAt);
    this.usage.set(namespace, { bytes: 0, operations: 0 });
    return { id: lease.workspaceId, expiresAt: lease.expiresAt };
  }

  async readFile(lease: GuestLeaseBinding, filePath: string): Promise<Uint8Array> {
    const namespace = this.assertLease(lease);
    this.consume(namespace, 1);
    const value = await this.options.store.read(namespace, cleanPath(filePath));
    if (!value) throw new Error('Guest workspace file not found');
    return value;
  }

  async writeFile(
    lease: GuestLeaseBinding,
    filePath: string,
    content: Uint8Array | string,
  ): Promise<{ success: true; path: string; sizeBytes: number }> {
    const namespace = this.assertLease(lease);
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.consume(namespace, 1, data.byteLength);
    await this.options.store.write(namespace, cleanPath(filePath), data);
    return { success: true, path: filePath, sizeBytes: data.byteLength };
  }

  async deleteFile(lease: GuestLeaseBinding, filePath: string): Promise<{ success: boolean }> {
    const namespace = this.assertLease(lease);
    this.consume(namespace, 1);
    return { success: await this.options.store.delete(namespace, cleanPath(filePath)) };
  }

  async listFiles(lease: GuestLeaseBinding, prefix = ''): Promise<GuestWorkspaceEntry[]> {
    const namespace = this.assertLease(lease);
    this.consume(namespace, 1);
    return this.options.store.list(namespace, cleanPath(prefix || 'root'));
  }

  async destroyWorkspace(lease: GuestLeaseBinding): Promise<boolean> {
    const namespace = this.assertLease(lease);
    this.usage.delete(namespace);
    return this.options.store.deleteNamespace(namespace);
  }

  async cleanup(): Promise<number> {
    const deleted = await this.options.store.deleteExpired(this.now());
    for (const namespace of this.usage.keys()) {
      if (!namespace.startsWith('guest/')) continue;
      this.usage.delete(namespace);
    }
    return deleted;
  }

  private assertLease(lease: GuestLeaseBinding): string {
    if (!lease.leaseId || !lease.appId || !lease.deploymentId || !lease.workspaceId) {
      throw new Error('Guest workspace requires a complete lease binding');
    }
    if (lease.expiresAt <= this.now()) throw new Error('Guest workspace lease is expired');
    return namespaceFor(lease);
  }

  private consume(namespace: string, operations: number, bytes = 0): void {
    const current = this.usage.get(namespace) ?? { bytes: 0, operations: 0 };
    if (operations < 0 || bytes < 0) throw new Error('Guest usage increments must be non-negative');
    if (current.operations + operations > this.quotas.maxOperations) {
      throw new Error('Guest operation quota exceeded');
    }
    if (current.bytes + bytes > this.quotas.maxBytes) {
      throw new Error('Guest byte quota exceeded');
    }
    this.usage.set(namespace, {
      bytes: current.bytes + bytes,
      operations: current.operations + operations,
    });
  }
}

export function createGuestWorkspaceProvider(
  options: GuestWorkspaceProviderOptions,
): GuestWorkspaceProvider {
  return new GuestWorkspaceProvider(options);
}

export type GuestCapability = 'workspace:read' | 'workspace:write' | 'runtime:invoke';

export interface GuestLease {
  id: string;
  appId: string;
  deploymentId: string;
  workspaceId: string;
  issuedAt: number;
  expiresAt: number;
  capabilities: readonly GuestCapability[];
  quota: { maxBytes: number; maxOperations: number };
  usage: { bytes: number; operations: number };
  revokedAt?: number;
}

export interface GuestLeaseRecord extends GuestLease {
  credentialHash: string;
}

export interface GuestLeaseStore {
  create(record: GuestLeaseRecord): Promise<void>;
  list(): Promise<GuestLeaseRecord[]>;
  get(id: string): Promise<GuestLeaseRecord | undefined>;
  revoke(id: string, at: number): Promise<void>;
  deleteExpired(now: number): Promise<number>;
}

export interface GuestProviderCapabilities {
  leaseStore: boolean;
  volatileWorkspace: boolean;
  leaseAffinity: boolean;
  ttlCleanup: boolean;
}

export interface GuestLeaseManagerOptions {
  store: GuestLeaseStore;
  provider: GuestProviderCapabilities;
  now?: () => number;
  minTtlMs?: number;
  maxTtlMs?: number;
  maxBytes?: number;
  maxOperations?: number;
  enabledCapabilities?: readonly GuestCapability[];
}

export interface GuestPrincipal {
  kind: 'guest';
  leaseId: string;
  appId: string;
  deploymentId: string;
  workspaceId: string;
}

const DEFAULT_MIN_TTL_MS = 60_000;
const DEFAULT_MAX_TTL_MS = 60 * 60_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_OPERATIONS = 1_000;
const TOKEN_BYTES = 32;

function randomHex(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCredential(credential: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class GuestLeaseManager {
  private readonly store: GuestLeaseStore;
  private readonly now: () => number;
  private readonly minTtlMs: number;
  private readonly maxTtlMs: number;
  private readonly maxBytes: number;
  private readonly maxOperations: number;
  private readonly enabledCapabilities: ReadonlySet<GuestCapability>;

  constructor(options: GuestLeaseManagerOptions) {
    const required: (keyof GuestProviderCapabilities)[] = [
      'leaseStore', 'volatileWorkspace', 'leaseAffinity', 'ttlCleanup',
    ];
    const unsupported = required.filter((capability) => !options.provider[capability]);
    if (unsupported.length > 0) {
      throw new Error(
        `Guest runtime unsupported: missing provider capabilities: ${unsupported.join(', ')}`,
      );
    }

    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.minTtlMs = options.minTtlMs ?? DEFAULT_MIN_TTL_MS;
    this.maxTtlMs = options.maxTtlMs ?? DEFAULT_MAX_TTL_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxOperations = options.maxOperations ?? DEFAULT_MAX_OPERATIONS;
    this.enabledCapabilities = new Set(options.enabledCapabilities ?? []);

    if (
      this.minTtlMs <= 0 || this.maxTtlMs < this.minTtlMs ||
      this.maxBytes <= 0 || this.maxOperations <= 0
    ) {
      throw new Error('Guest lease limits must be positive and internally consistent');
    }
  }

  async issue(input: {
    appId: string;
    deploymentId: string;
    workspaceId: string;
    ttlMs: number;
    capabilities: readonly GuestCapability[];
  }): Promise<{ credential: string; lease: GuestLease }> {
    if (!input.appId || !input.deploymentId || !input.workspaceId) {
      throw new Error('Guest lease requires app, deployment, and workspace binding');
    }
    if (input.ttlMs < this.minTtlMs || input.ttlMs > this.maxTtlMs) {
      throw new Error('Guest lease TTL is outside the configured bounds');
    }

    const capabilities = [...new Set(input.capabilities)];
    const denied = capabilities.filter((capability) => !this.enabledCapabilities.has(capability));
    if (denied.length > 0) {
      throw new Error(`Guest capability denied: ${denied.join(', ')}`);
    }

    const issuedAt = this.now();
    const lease: GuestLease = {
      id: randomHex(16),
      appId: input.appId,
      deploymentId: input.deploymentId,
      workspaceId: input.workspaceId,
      issuedAt,
      expiresAt: issuedAt + input.ttlMs,
      capabilities,
      quota: { maxBytes: this.maxBytes, maxOperations: this.maxOperations },
      usage: { bytes: 0, operations: 0 },
    };

    const credential = randomHex(TOKEN_BYTES);
    await this.store.create({ ...lease, credentialHash: await hashCredential(credential) });
    return { credential, lease };
  }

  async authenticate(input: {
    credential: string;
    appId: string;
    deploymentId: string;
    workspaceId: string;
  }): Promise<GuestPrincipal | null> {
    const credentialHash = await hashCredential(input.credential);

    for (const candidate of await this.store.list()) {
      if (candidate.credentialHash !== credentialHash) continue;
      if (candidate.revokedAt !== undefined || candidate.expiresAt <= this.now()) return null;
      if (
        candidate.appId !== input.appId ||
        candidate.deploymentId !== input.deploymentId ||
        candidate.workspaceId !== input.workspaceId
      ) return null;

      return {
        kind: 'guest',
        leaseId: candidate.id,
        appId: candidate.appId,
        deploymentId: candidate.deploymentId,
        workspaceId: candidate.workspaceId,
      };
    }
    return null;
  }

  async revoke(leaseId: string): Promise<void> {
    await this.store.revoke(leaseId, this.now());
  }

  async cleanup(): Promise<number> {
    return this.store.deleteExpired(this.now());
  }
}

export function assertGuestCapability(
  principal: GuestPrincipal,
  lease: GuestLease,
  capability: GuestCapability,
  now = Date.now(),
): void {
  if (principal.kind !== 'guest' || principal.leaseId !== lease.id) {
    throw new Error('Guest principal does not match lease');
  }
  if (lease.revokedAt !== undefined || lease.expiresAt <= now) {
    throw new Error('Guest lease is inactive');
  }
  if (!lease.capabilities.includes(capability)) {
    throw new Error(`Guest capability denied: ${capability}`);
  }
}

export function consumeGuestQuota(
  lease: GuestLease,
  usage: { bytes?: number; operations?: number },
): void {
  const bytes = usage.bytes ?? 0;
  const operations = usage.operations ?? 0;
  if (bytes < 0 || operations < 0) {
    throw new Error('Guest quota usage increments must be non-negative');
  }
  if (lease.usage.bytes + bytes > lease.quota.maxBytes) {
    throw new Error('Guest byte quota exceeded');
  }
  if (lease.usage.operations + operations > lease.quota.maxOperations) {
    throw new Error('Guest operation quota exceeded');
  }
  lease.usage.bytes += bytes;
  lease.usage.operations += operations;
}

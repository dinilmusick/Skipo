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

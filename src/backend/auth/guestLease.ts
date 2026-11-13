export type GuestLeaseStatus = "active" | "revoked" | "expired";

export interface GuestLeaseRecord {
  readonly leaseId: string;
  readonly appId: string;
  readonly deploymentId: string;
  readonly workspaceId: string;
  readonly capabilities: readonly string[];
  readonly credentialHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly absoluteExpiresAt: number;
  readonly lastActivityAt: number;
  readonly status: GuestLeaseStatus;
}

export interface GuestLeaseStore {
  createIfAbsent(record: GuestLeaseRecord): Promise<boolean>;
  getByCredentialHash(hash: string): Promise<GuestLeaseRecord | null>;
  revoke(leaseId: string, now: number): Promise<boolean>;
}

export interface GuestLeaseServiceOptions {
  appId: string;
  deploymentId: string;
  store: GuestLeaseStore;
  now?: () => number;
  idleTtlMs?: number;
  absoluteLifetimeMs?: number;
  approvedCapabilities?: readonly string[];
}

export interface IssuedGuestLease {
  readonly credential: string;
  readonly record: GuestLeaseRecord;
}

export interface GuestLeasePrincipal {
  readonly kind: "guest";
  readonly leaseId: string;
  readonly appId: string;
  readonly deploymentId: string;
  readonly workspaceId: string;
  readonly capabilities: readonly string[];
}

const IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hashCredential(credential: string): Promise<string> {
  const bytes = new TextEncoder().encode(credential);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function duration(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
  return value;
}

export class GuestLeaseService {
  private readonly appId: string;
  private readonly deploymentId: string;
  private readonly store: GuestLeaseStore;
  private readonly now: () => number;
  private readonly idleTtlMs: number;
  private readonly absoluteLifetimeMs: number;
  private readonly approvedCapabilities: readonly string[];

  constructor(options: GuestLeaseServiceOptions) {
    if (!options.appId || !options.deploymentId) throw new Error("Guest lease scope is required.");
    if (options.appId.toLowerCase() === "luth") throw new Error("Luth cannot use guest leases.");
    this.appId = options.appId;
    this.deploymentId = options.deploymentId;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.idleTtlMs = duration(options.idleTtlMs ?? IDLE_TTL_MS, "idleTtlMs");
    this.absoluteLifetimeMs = duration(options.absoluteLifetimeMs ?? ABSOLUTE_LIFETIME_MS, "absoluteLifetimeMs");
    this.approvedCapabilities = [...new Set(options.approvedCapabilities ?? [])];
  }

  async issue(input: { workspaceId: string; capabilities?: readonly string[] }): Promise<IssuedGuestLease> {
    if (!input.workspaceId) throw new Error("Guest lease workspaceId is required.");
    const capabilities = [...new Set(input.capabilities ?? [])];
    if (capabilities.some((capability) => !this.approvedCapabilities.includes(capability))) {
      throw new Error("Guest lease requested an unapproved capability.");
    }
    const issuedAt = this.now();
    const absoluteExpiresAt = issuedAt + this.absoluteLifetimeMs;
    const credentialBytes = new Uint8Array(32);
    crypto.getRandomValues(credentialBytes);
    const credential = base64Url(credentialBytes);
    const record: GuestLeaseRecord = {
      leaseId: crypto.randomUUID(),
      appId: this.appId,
      deploymentId: this.deploymentId,
      workspaceId: input.workspaceId,
      capabilities,
      credentialHash: await hashCredential(credential),
      issuedAt,
      expiresAt: Math.min(issuedAt + this.idleTtlMs, absoluteExpiresAt),
      absoluteExpiresAt,
      lastActivityAt: issuedAt,
      status: "active",
    };
    if (!(await this.store.createIfAbsent(record))) throw new Error("Guest lease allocation collided.");
    return { credential, record };
  }

  async validate(credential: string | null | undefined, requiredCapability?: string): Promise<GuestLeasePrincipal | null> {
    if (!credential || credential.length < 43) return null;
    const record = await this.store.getByCredentialHash(await hashCredential(credential));
    if (!record) return null;
    const now = this.now();
    if (record.status !== "active" || record.appId !== this.appId ||
        record.deploymentId !== this.deploymentId || now >= record.expiresAt || now >= record.absoluteExpiresAt) return null;
    if (requiredCapability !== undefined && !record.capabilities.includes(requiredCapability)) return null;
    return { kind: "guest", leaseId: record.leaseId, appId: record.appId, deploymentId: record.deploymentId,
      workspaceId: record.workspaceId, capabilities: record.capabilities };
  }

  async revoke(leaseId: string): Promise<boolean> {
    return this.store.revoke(leaseId, this.now());
  }

  static guestCookieHeader(credential: string, maxAgeSeconds: number): string {
    if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds <= 0) throw new Error("Invalid guest cookie lifetime.");
    return `__Host-skipo_guest=${encodeURIComponent(credential)}; Max-Age=${maxAgeSeconds}; Path=/; Secure; HttpOnly; SameSite=Lax`;
  }
}

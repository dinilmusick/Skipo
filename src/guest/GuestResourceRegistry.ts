export type GuestResourceKind = "workspace" | "runtime" | "timer" | "socket" | "worker" | "subscription" | "cache";

export interface GuestResourceMetrics {
  readonly active: number;
  readonly registered: number;
  readonly released: number;
  readonly releaseFailures: number;
  readonly retries: number;
}

interface ResourceRecord {
  readonly id: string;
  readonly leaseId: string;
  readonly kind: GuestResourceKind;
  readonly cleanup: () => Promise<void> | void;
  released: boolean;
  attempts: number;
}

export class GuestResourceRegistry {
  private readonly resources = new Map<string, ResourceRecord>();
  private registered = 0;
  private released = 0;
  private releaseFailures = 0;
  private retries = 0;

  register(input: {
    id: string;
    leaseId: string;
    kind: GuestResourceKind;
    cleanup: () => Promise<void> | void;
  }): () => Promise<boolean> {
    if (!input.id || !input.leaseId) throw new Error("Guest resource identity is required.");
    const existing = this.resources.get(input.id);
    if (existing && existing.leaseId === input.leaseId && existing.kind === input.kind) {
      return async () => this.release(input.id);
    }
    if (existing) throw new Error("Guest resource is already registered.");
    const record: ResourceRecord = { ...input, released: false, attempts: 0 };
    this.resources.set(input.id, record);
    this.registered += 1;

    return async () => this.release(input.id);
  }

  async release(id: string, maxAttempts = 3): Promise<boolean> {
    const record = this.resources.get(id);
    if (!record || record.released) return false;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) throw new Error("maxAttempts must be positive.");

    while (record.attempts < maxAttempts && !record.released) {
      record.attempts += 1;
      if (record.attempts > 1) this.retries += 1;
      try {
        await record.cleanup();
        record.released = true;
        this.resources.delete(id);
        this.released += 1;
        return true;
      } catch {
        if (record.attempts >= maxAttempts) this.releaseFailures += 1;
      }
    }
    return false;
  }

  async releaseLease(leaseId: string, maxAttempts = 3): Promise<{ released: number; failed: number }> {
    const records = [...this.resources.values()].filter((resource) => resource.leaseId === leaseId && !resource.released);
    let released = 0;
    let failed = 0;
    for (const record of records) {
      if (await this.release(record.id, maxAttempts)) released += 1;
      else failed += 1;
    }
    return { released, failed };
  }

  metrics(): GuestResourceMetrics {
    return {
      active: this.resources.size,
      registered: this.registered,
      released: this.released,
      releaseFailures: this.releaseFailures,
      retries: this.retries,
    };
  }

  activeLeaseCount(): number {
    return new Set([...this.resources.values()].map((resource) => resource.leaseId)).size;
  }
}

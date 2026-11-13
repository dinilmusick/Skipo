import { describe, expect, it } from "vitest";
import { GuestLeaseService, type GuestLeaseRecord, type GuestLeaseStore } from "./guestLease.js";

class MemoryLeaseStore implements GuestLeaseStore {
  private readonly records = new Map<string, GuestLeaseRecord>();

  async createIfAbsent(record: GuestLeaseRecord) {
    if (this.records.has(record.leaseId)) return false;
    this.records.set(record.leaseId, record);
    return true;
  }

  async getByCredentialHash(hash: string) {
    return [...this.records.values()].find((record) => record.credentialHash === hash) ?? null;
  }

  async revoke(leaseId: string, now: number) {
    const record = this.records.get(leaseId);
    if (!record || record.status !== "active") return false;
    this.records.set(leaseId, { ...record, status: "revoked", lastActivityAt: now });
    return true;
  }
}

describe("GuestLeaseService", () => {
  it("issues a 256-bit opaque credential and never stores the raw value", async () => {
    const store = new MemoryLeaseStore();
    const service = new GuestLeaseService({ appId: "demo", deploymentId: "prod", store });
    const issued = await service.issue({ workspaceId: "lease-workspace" });

    expect(issued.credential).toHaveLength(43);
    expect(issued.record.credentialHash).not.toBe(issued.credential);
    expect(issued.record.workspaceId).toBe("lease-workspace");
    expect(issued.record.appId).toBe("demo");
  });

  it("validates scope and approved capabilities server-side", async () => {
    let now = 1_000;
    const store = new MemoryLeaseStore();
    const service = new GuestLeaseService({
      appId: "demo", deploymentId: "prod", store, now: () => now,
      approvedCapabilities: ["workspace.read"],
    });
    const issued = await service.issue({ workspaceId: "w1", capabilities: ["workspace.read"] });

    await expect(service.validate(issued.credential, "workspace.read")).resolves.toMatchObject({
      kind: "guest", leaseId: issued.record.leaseId, workspaceId: "w1",
    });
    await expect(service.validate(issued.credential, "workspace.write")).resolves.toBeNull();

    const wrongApp = new GuestLeaseService({ appId: "other", deploymentId: "prod", store, now: () => now });
    const wrongDeployment = new GuestLeaseService({ appId: "demo", deploymentId: "staging", store, now: () => now });
    await expect(wrongApp.validate(issued.credential)).resolves.toBeNull();
    await expect(wrongDeployment.validate(issued.credential)).resolves.toBeNull();
  });

  it("rejects forged, expired, and revoked credentials", async () => {
    let now = 1_000;
    const store = new MemoryLeaseStore();
    const service = new GuestLeaseService({ appId: "demo", deploymentId: "prod", store, now: () => now, idleTtlMs: 100 });
    const issued = await service.issue({ workspaceId: "w1" });

    await expect(service.validate(`${issued.credential}forged`)).resolves.toBeNull();
    now = 1_101;
    await expect(service.validate(issued.credential)).resolves.toBeNull();

    now = 2_000;
    const fresh = await service.issue({ workspaceId: "w2" });
    await expect(service.revoke(fresh.record.leaseId)).resolves.toBe(true);
    await expect(service.validate(fresh.credential)).resolves.toBeNull();
    await expect(service.validate(fresh.credential)).resolves.toBeNull();
  });

  it("fails closed for Luth and uses a host-only HttpOnly cookie", () => {
    expect(() => new GuestLeaseService({
      appId: "luth", deploymentId: "prod", store: new MemoryLeaseStore(),
    })).toThrow("Luth");

    const cookie = GuestLeaseService.guestCookieHeader("opaque", 300);
    expect(cookie).toContain("__Host-skipo_guest=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });
});

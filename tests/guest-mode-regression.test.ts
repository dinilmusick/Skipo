import { describe, expect, it } from "vitest";
import { GuestLeaseService, type GuestLeaseRecord, type GuestLeaseStore } from "../src/backend/auth/guestLease.js";
import { createGuestModePolicy, guestCan, guestWorkspaceNamespace } from "../src/guest/GuestMode.js";
import { GuestResourceRegistry } from "../src/guest/GuestResourceRegistry.js";

class Store implements GuestLeaseStore {
  records = new Map<string, GuestLeaseRecord>();
  async createIfAbsent(record: GuestLeaseRecord) {
    if (this.records.has(record.credentialHash)) return false;
    this.records.set(record.credentialHash, record);
    return true;
  }
  async getByCredentialHash(hash: string) { return this.records.get(hash) ?? null; }
  async revoke(leaseId: string, now: number) {
    for (const [key, value] of this.records) {
      if (value.leaseId === leaseId) {
        this.records.set(key, { ...value, status: "revoked", expiresAt: now });
        return true;
      }
    }
    return false;
  }
}

describe("guest mode framework regression", () => {
  it("keeps guest policy distinct from authenticated identity and excludes Luth", () => {
    const policy = createGuestModePolicy("demo", "prod", ["workspace.read"]);
    expect(policy.luthExcluded).toBe(true);
    expect(guestCan(policy, "workspace.read")).toBe(true);
    expect(guestCan(policy, "admin.read")).toBe(false);
    expect(() => createGuestModePolicy("luth", "prod")).toThrow(/Luth/);
  });

  it("binds workspace routing to the validated lease tuple", () => {
    expect(guestWorkspaceNamespace({
      kind: "guest",
      leaseId: "lease-a",
      appId: "demo",
      deploymentId: "prod",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read"],
    })).toBe("guest/demo/prod/lease-a/workspace-a");
  });

  it("rejects forged, wrong-deployment and revoked credentials", async () => {
    let now = 1_000;
    const store = new Store();
    const service = new GuestLeaseService({
      appId: "demo",
      deploymentId: "prod",
      store,
      now: () => now,
      approvedCapabilities: ["workspace.read"],
      idleTtlMs: 500,
      absoluteLifetimeMs: 2_000,
    });
    const issued = await service.issue({ workspaceId: "workspace-a", capabilities: ["workspace.read"] });
    expect(await service.validate("forged".padEnd(43, "x"))).toBeNull();
    expect(await service.validate(issued.credential)).toMatchObject({ leaseId: issued.record.leaseId });
    now = 2_000;
    expect(await service.validate(issued.credential)).toBeNull();

    now = 1_000;
    const fresh = await service.issue({ workspaceId: "workspace-b" });
    expect(await new GuestLeaseService({
      appId: "demo",
      deploymentId: "staging",
      store,
      now: () => now,
    }).validate(fresh.credential)).toBeNull();
    await service.revoke(fresh.record.leaseId);
    expect(await service.validate(fresh.credential)).toBeNull();
  });

  it("keeps resource cleanup bounded and lease-scoped", async () => {
    const registry = new GuestResourceRegistry();
    const released: string[] = [];
    registry.register({ id: "a", leaseId: "lease-a", kind: "runtime", cleanup: () => { released.push("a"); } });
    registry.register({ id: "b", leaseId: "lease-b", kind: "runtime", cleanup: () => { released.push("b"); } });
    expect(await registry.releaseLease("lease-a")).toEqual({ released: 1, failed: 0 });
    expect(released).toEqual(["a"]);
    expect(registry.metrics().active).toBe(1);
  });

  it("does not expose raw guest credentials through policy or metrics state", () => {
    const policy = createGuestModePolicy("demo", "prod", ["workspace.read"]);
    const registry = new GuestResourceRegistry();
    registry.register({ id: "workspace:lease-a", leaseId: "lease-a", kind: "workspace", cleanup: () => undefined });
    expect(JSON.stringify(policy)).not.toContain("credential");
    expect(JSON.stringify(registry.metrics())).not.toContain("lease-a");
  });
});

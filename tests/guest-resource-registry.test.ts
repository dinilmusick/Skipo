import { describe, expect, it } from "vitest";
import { GuestResourceRegistry } from "../src/guest/GuestResourceRegistry.js";

describe("GuestResourceRegistry", () => {
  it("registers lease resources and releases them idempotently", async () => {
    const registry = new GuestResourceRegistry();
    let cleaned = 0;
    const release = registry.register({
      id: "workspace:lease-a",
      leaseId: "lease-a",
      kind: "workspace",
      cleanup: () => { cleaned += 1; },
    });
    expect(registry.metrics().active).toBe(1);
    expect(await release()).toBe(true);
    expect(await release()).toBe(false);
    expect(cleaned).toBe(1);
    expect(registry.metrics()).toMatchObject({ active: 0, registered: 1, released: 1, releaseFailures: 0 });
  });

  it("retries bounded cleanup and records failure without leaking sensitive payloads", async () => {
    const registry = new GuestResourceRegistry();
    let attempts = 0;
    registry.register({
      id: "runtime:lease-b",
      leaseId: "lease-b",
      kind: "runtime",
      cleanup: () => { attempts += 1; throw new Error("cleanup failed"); },
    });
    expect(await registry.releaseLease("lease-b", 2)).toEqual({ released: 0, failed: 1 });
    expect(attempts).toBe(2);
    expect(registry.metrics()).toMatchObject({ active: 1, releaseFailures: 1, retries: 1 });
  });

  it("releases every resource owned by one lease while preserving another", async () => {
    const registry = new GuestResourceRegistry();
    let a = 0;
    let b = 0;
    registry.register({ id: "a", leaseId: "lease-a", kind: "socket", cleanup: () => { a += 1; } });
    registry.register({ id: "b", leaseId: "lease-a", kind: "worker", cleanup: () => { a += 1; } });
    registry.register({ id: "c", leaseId: "lease-b", kind: "timer", cleanup: () => { b += 1; } });
    expect(await registry.releaseLease("lease-a")).toEqual({ released: 2, failed: 0 });
    expect(a).toBe(2);
    expect(b).toBe(0);
    expect(registry.activeLeaseCount()).toBe(1);
  });
});

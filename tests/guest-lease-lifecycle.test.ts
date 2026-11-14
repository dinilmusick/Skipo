import { describe, expect, it } from "vitest";
import { GuestResourceRegistry } from "../src/guest/GuestResourceRegistry.js";
import {
  createGuestTeardownHandler,
  installGuestPageExitSignal,
  runAuthoritativeGuestCleanup,
} from "../src/guest/GuestLeaseLifecycle.js";

describe("guest lease lifecycle", () => {
  it("tears down the exact lease and workspace and is origin protected", async () => {
    const calls: string[] = [];
    const handler = createGuestTeardownHandler({
      allowedOrigins: ["https://app.example"],
      resolveLease: async (credential) => credential === "valid" ? {
        leaseId: "lease-a",
        workspaceNamespace: "guest/app/prod/lease-a/workspace-a",
      } : null,
      authority: {
        revoke: async (leaseId) => { calls.push("revoke:" + leaseId); return true; },
        destroyWorkspace: async (namespace) => { calls.push("destroy:" + namespace); return true; },
        deleteExpired: async () => 0,
      },
    });
    const request = new Request("https://app.example/api/guest/teardown", {
      method: "POST",
      headers: { origin: "https://app.example", cookie: "__Host-skipo_guest=valid" },
      body: "{}",
    });
    await expect(handler(request)).resolves.toMatchObject({
      status: 200,
    });
    expect(calls).toEqual([
      "revoke:lease-a",
      "destroy:guest/app/prod/lease-a/workspace-a",
    ]);
    const forged = await handler(new Request("https://app.example/api/guest/teardown", {
      method: "POST",
      headers: { origin: "https://evil.example", cookie: "__Host-skipo_guest=valid" },
      body: "{}",
    }));
    expect(forged?.status).toBe(403);
  });

  it("releases lease resources before workspace destruction", async () => {
    const order: string[] = [];
    const registry = new GuestResourceRegistry();
    registry.register({
      id: "runtime-a",
      leaseId: "lease-a",
      kind: "runtime",
      cleanup: () => { order.push("resource"); },
    });
    const handler = createGuestTeardownHandler({
      registry,
      resolveLease: async () => ({ leaseId: "lease-a", workspaceNamespace: "guest/app/prod/lease-a/workspace-a" }),
      authority: {
        revoke: async () => { order.push("revoke"); return true; },
        destroyWorkspace: async () => { order.push("workspace"); return true; },
        deleteExpired: async () => 0,
      },
    });
    await handler(new Request("https://app.example/api/guest/teardown", {
      method: "POST",
      headers: { cookie: "__Host-skipo_guest=valid" },
      body: "{}",
    }));
    expect(order).toEqual(["resource", "revoke", "workspace"]);
  });

  it("provides a bounded authoritative reaper independent of page exit", async () => {
    let seen = 0;
    await expect(runAuthoritativeGuestCleanup({
      deleteExpired: async (now) => { seen = now; return 3; },
    }, 1234)).resolves.toBe(3);
    expect(seen).toBe(1234);
  });

  it("uses sendBeacon first and keeps a fetch keepalive fallback", () => {
    const listeners: Record<string, (event: Event) => void> = {};
    const oldWindow = globalThis.window;
    const oldNavigator = globalThis.navigator;
    let beaconCalls = 0;
    globalThis.window = {
      addEventListener: (name: string, callback: EventListenerOrEventListenerObject) => { listeners[name] = callback as (event: Event) => void; },
      removeEventListener: () => undefined,
    } as unknown as Window & typeof globalThis;
    globalThis.navigator = {
      sendBeacon: () => { beaconCalls += 1; return true; },
    } as unknown as Navigator;
    const cleanup = installGuestPageExitSignal({ endpoint: "/api/guest/teardown", fetchImpl: async () => new Response(null) });
    listeners.pagehide?.(new Event("pagehide"));
    cleanup();
    expect(beaconCalls).toBe(1);
    globalThis.window = oldWindow;
    globalThis.navigator = oldNavigator;
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppExternalInterfaces } from "../externalInterfaces.js";
import type { BackendFacade } from "../BackendFacade.js";
import type { GuestLeaseService, GuestLeasePrincipal } from "../auth/guestLease.js";
import type { GuestAbuseLimiter } from "./guestRequestGuard.js";

const guest: GuestLeasePrincipal = {
  kind: "guest", leaseId: "lease-1", appId: "demo", deploymentId: "prod",
  workspaceId: "workspace-1", capabilities: ["workspace.read"],
};
const capabilities = [
  { id: "workspace.read", name: "workspace.read", description: "Read own temporary workspace",
    inputSchema: { type: "object" }, outputSchema: { type: "object" },
    serviceId: "workspace", invocation: { operation: "read" } },
  { id: "account.manage", name: "account.manage", description: "Manage account",
    inputSchema: { type: "object" }, outputSchema: { type: "object" },
    serviceId: "account", invocation: { operation: "manage" } },
];
function makeLimiter(): GuestAbuseLimiter {
  return { consume: vi.fn(async () => true), acquire: vi.fn(async () => vi.fn()) };
}
describe("Skipo external guest route integration", () => {
  afterEach(() => vi.restoreAllMocks());
  it("validates guest leases and exposes only the explicit framework allow-list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ authenticated: false }), { status: 401 }));
    const backend = { listCapabilities: () => capabilities } as unknown as BackendFacade;
    const validate = vi.fn(async () => guest);
    const limiter = makeLimiter();
    const external = createAppExternalInterfaces(backend, {
      guestLeaseService: { validate } as unknown as GuestLeaseService,
      guestCapabilities: ["workspace.read"],
      guestRequestGuard: { limiter, getClientIp: () => "203.0.113.9" },
    });
    const response = await external.http(new Request("https://demo.test/api/capabilities", {
      headers: { cookie: "__Host-skipo_guest=opaque-credential" },
    }));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ capabilities: [{ id: "workspace.read" }] });
    expect(validate).toHaveBeenCalled();
    expect(limiter.consume).toHaveBeenCalledTimes(2);
    expect(limiter.acquire).toHaveBeenCalledTimes(2);
  });
  it("fails closed when a guest lease is valid but abuse controls are not configured", async () => {
    const backend = { listCapabilities: () => [] } as unknown as BackendFacade;
    const external = createAppExternalInterfaces(backend, {
      guestLeaseService: { validate: vi.fn(async () => guest) } as unknown as GuestLeaseService,
    });
    const response = await external.http(new Request("https://demo.test/api/capabilities", {
      headers: { cookie: "__Host-skipo_guest=opaque-credential" },
    }));
    expect(response?.status).toBe(503);
  });
  it("rejects invalid guest credentials before exposing external capabilities", async () => {
    const backend = { listCapabilities: () => capabilities } as unknown as BackendFacade;
    const external = createAppExternalInterfaces(backend, {
      guestLeaseService: { validate: vi.fn(async () => null) } as unknown as GuestLeaseService,
      guestCapabilities: ["workspace.read"],
      guestRequestGuard: { limiter: makeLimiter(), getClientIp: () => "203.0.113.10" },
    });
    const response = await external.http(new Request("https://demo.test/api/capabilities", {
      headers: { cookie: "__Host-skipo_guest=forged" },
    }));
    expect(response?.status).toBe(401);
  });
});

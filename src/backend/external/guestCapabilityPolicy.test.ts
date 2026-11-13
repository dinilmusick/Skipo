import { describe, expect, it, vi } from "vitest";
import { CapabilityRegistry } from "./registry.js";
import type { GuestExternalPrincipal } from "./contract.js";

const capability = {
  id: "workspace.read", description: "Read the current workspace", inputSchema: { type: "object" as const },
  outputSchema: { type: "object" as const }, invocation: { serviceId: "workspace", operationId: "read" },
};
const guest: GuestExternalPrincipal = {
  kind: "guest", leaseId: "lease-1", appId: "demo", deploymentId: "prod",
  workspaceId: "workspace-1", capabilities: ["workspace.read"],
};
describe("guest capability authorization", () => {
  it("denies guest principals by default, including unclassified capabilities", async () => {
    const executor = { execute: vi.fn(async () => ({})) };
    const registry = new CapabilityRegistry(executor).register(capability);
    expect(registry.list(guest)).toEqual([]);
    await expect(registry.invoke("workspace.read", {}, { principal: guest, transport: "http", requestId: "r1" })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(executor.execute).not.toHaveBeenCalled();
  });
  it("allows only explicitly guest-enabled capabilities held by the lease", async () => {
    const executor = { execute: vi.fn(async () => ({})) };
    const registry = new CapabilityRegistry(executor).register({ ...capability, guestAccess: true });
    expect(registry.list(guest).map(item => item.id)).toEqual(["workspace.read"]);
    await expect(registry.invoke("workspace.read", {}, { principal: guest, transport: "http", requestId: "r1" })).resolves.toEqual({});
    const wrongLease = { ...guest, capabilities: [] };
    await expect(registry.invoke("workspace.read", {}, { principal: wrongLease, transport: "http", requestId: "r2" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not weaken authenticated or role-based checks", () => {
    const registry = new CapabilityRegistry({ execute: vi.fn(async () => ({})) });
    registry.register({ ...capability, access: "roles", requiredRoles: ["admin"], guestAccess: true });
    expect(registry.list({ userId: "user-1", roles: ["member"] })).toEqual([]);
    expect(registry.list({ userId: "user-1", roles: ["admin"] })).toHaveLength(1);
    expect(registry.list(null)).toEqual([]);
  });
});

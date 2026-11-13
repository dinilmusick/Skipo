import { describe, expect, it, vi } from "vitest";
import { createBackendCapabilityExecutor } from "./backendExecutor.js";
import type { GuestExternalPrincipal } from "./contract.js";
import type { IBackendFacade } from "../BackendFacadeTypes.js";

describe("external backend principal propagation", () => {
  it("preserves guest lease scope without manufacturing authenticated identity", async () => {
    const executeCapability = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
    const backend = { executeCapability } as unknown as IBackendFacade;
    const guest: GuestExternalPrincipal = {
      kind: "guest", leaseId: "lease-1", appId: "demo", deploymentId: "prod",
      workspaceId: "temporary-workspace", capabilities: ["workspace.read"],
    };
    const executor = createBackendCapabilityExecutor(backend);
    await executor.execute("workspace", "read", {}, { principal: guest, transport: "http", requestId: "request-1" });
    const options = executeCapability.mock.calls[0][3] as { metadata: { principal: Record<string, unknown> } };
    expect(options.metadata.principal).toEqual({
      kind: "guest", leaseId: "lease-1", appId: "demo", deploymentId: "prod",
      workspaceId: "temporary-workspace", capabilities: ["workspace.read"],
    });
    expect(options.metadata.principal).not.toHaveProperty("userId");
    expect(options.metadata.principal).not.toHaveProperty("sessionId");
  });
  it("preserves authenticated principal metadata for existing callers", async () => {
    const executeCapability = vi.fn(async () => ({ ok: true }));
    const executor = createBackendCapabilityExecutor({ executeCapability } as unknown as IBackendFacade);
    await executor.execute("workspace", "read", {}, {
      principal: { userId: "user-1", roles: ["member"], sessionId: "session-1" },
      transport: "http", requestId: "request-2",
    });
    const options = executeCapability.mock.calls[0][3] as { metadata: { principal: Record<string, unknown> } };
    expect(options.metadata.principal).toMatchObject({ kind: "authenticated", userId: "user-1", sessionId: "session-1" });
  });
});

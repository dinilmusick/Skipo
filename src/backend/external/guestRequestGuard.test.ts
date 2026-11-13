import { describe, expect, it, vi } from "vitest";
import { withGuestRequestGuards, type GuestAbuseLimiter } from "./guestRequestGuard.js";
import type { GuestExternalPrincipal } from "./contract.js";

const principal: GuestExternalPrincipal = {
  kind: "guest", leaseId: "lease-1", appId: "demo", deploymentId: "prod",
  workspaceId: "workspace-1", capabilities: ["workspace.read"],
};
function limiter(overrides: Partial<GuestAbuseLimiter> = {}): GuestAbuseLimiter {
  return {
    consume: vi.fn(async () => true),
    acquire: vi.fn(async () => vi.fn()),
    ...overrides,
  };
}
describe("guest request guards", () => {
  it("requires explicit controls and fails closed when they are missing", async () => {
    const response = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities"), principal, undefined, async () => new Response("ok"));
    expect(response.status).toBe(503);
  });
  it("rejects cross-origin and originless state-changing requests", async () => {
    const controls = { limiter: limiter(), getClientIp: () => "203.0.113.1" };
    const crossOrigin = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities/x/invoke", { method: "POST", headers: { origin: "https://evil.test" } }), principal, controls, async () => new Response("ok"));
    const missingOrigin = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities/x/invoke", { method: "POST" }), principal, controls, async () => new Response("ok"));
    expect(crossOrigin.status).toBe(403);
    expect(missingOrigin.status).toBe(403);
  });
  it("enforces per-IP and per-lease rate limits", async () => {
    const consume = vi.fn(async (key: string) => !key.includes("lease:"));
    const controls = { limiter: limiter({ consume }), getClientIp: () => "203.0.113.2" };
    const response = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities"), principal, controls, async () => new Response("ok"));
    expect(response.status).toBe(429);
    expect(consume).toHaveBeenCalledTimes(2);
  });
  it("enforces concurrency limits and releases acquired slots", async () => {
    const release = vi.fn();
    const acquire = vi.fn(async (key: string) => key.includes("lease:") ? null : release);
    const controls = { limiter: limiter({ acquire }), getClientIp: () => "203.0.113.3" };
    const response = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities"), principal, controls, async () => new Response("ok"));
    expect(response.status).toBe(429);
    expect(release).toHaveBeenCalledOnce();
  });
  it("bounds request bodies and allows same-origin requests", async () => {
    const controls = { limiter: limiter(), getClientIp: () => "203.0.113.4", maxBodyBytes: 4 };
    const oversized = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities/x/invoke", { method: "POST", headers: { origin: "https://demo.test", "content-type": "application/json" }, body: JSON.stringify({ long: true }) }), principal, controls, async () => new Response("ok"));
    expect(oversized.status).toBe(413);
    const ok = await withGuestRequestGuards(new Request("https://demo.test/api/capabilities", { method: "GET" }), principal, controls, async () => new Response("ok"));
    expect(ok.status).toBe(200);
  });
});

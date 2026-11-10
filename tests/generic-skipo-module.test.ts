import { describe, expect, it } from "vitest";
import { SkipoModuleHost } from "../src/modules/SkipoModuleHost.js";
import type { BackendFacade, SkipoModule } from "../src/modules/ModuleContracts.js";
import { GenericSkipoModule } from "./fixtures/generic-skipo-module/module.js";
import { MockBackendFacade } from "./fixtures/generic-skipo-module/backend.js";
import { runStandaloneFixture } from "./fixtures/generic-skipo-module/standalone.js";

describe("generic Skipo module development and testing fixture", () => {
  it("runs as a complete standalone application without a parent application", async () => {
    const result = await runStandaloneFixture();
    expect(result.discovered).toHaveLength(1);
    expect(result.mounted.context.mode).toBe("standalone");
    expect(result.mounted.context.application.applicationId).toBe("generic-inventory-standalone");
    expect(result.overview).toMatchObject({ surface: "overview", mode: "standalone" });
    await result.mounted.dispose();
  });

  it("discovers and mounts in an embedded parent context", async () => {
    const module = new GenericSkipoModule();
    const backend = new MockBackendFacade();
    const host = new SkipoModuleHost();
    const discovered = host.discover([module]);
    expect(discovered[0]).toMatchObject({ id: "example.inventory", version: "1.0.0" });
    const mounted = await host.mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm", workspaceId: "workspace-42", userId: "user-7" },
      backend,
      approvedCapabilities: ["inventory.list", "inventory.reserve"],
    });
    expect(mounted.context.application).toMatchObject({
      applicationId: "parent.crm", workspaceId: "workspace-42", userId: "user-7",
    });
    expect(mounted.state).toBe("mounted");
    await mounted.dispose();
  });

  it("discovers parent capabilities and exposes input/output schemas and approval state", async () => {
    const module = new GenericSkipoModule();
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm" },
      backend: new MockBackendFacade(),
      approvedCapabilities: ["inventory.list", "inventory.reserve"],
    });
    const discovered = mounted.context.backend.discoverCapabilities();
    expect(discovered).toHaveLength(3);
    const listing = mounted.context.backend.inspectCapability("inventory.list");
    expect(listing.inputSchema).toMatchObject({
      type: "object", required: ["category"], properties: { category: { type: "string" } },
    });
    expect(listing.outputSchema).toMatchObject({
      type: "object", required: ["items"], properties: { items: { type: "array" } },
    });
    expect(listing.approved).toBe(true);
    expect(mounted.context.backend.inspectCapability("billing.refund").approved).toBe(false);
    await mounted.dispose();
  });

  it("invokes approved capabilities and propagates module and parent identity", async () => {
    const module = new GenericSkipoModule();
    const backend = new MockBackendFacade();
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm", userId: "user-7" },
      backend,
      approvedCapabilities: ["inventory.list", "inventory.reserve"],
    });
    expect(await module.listInventory("hardware")).toEqual({ items: ["gear", "sensor", "actuator"] });
    expect(await module.reserve("sensor-1", 2)).toEqual({ reservationId: "res-sensor-1-2", accepted: true });
    expect(backend.calls).toHaveLength(2);
    expect(backend.calls[0].context).toMatchObject({
      moduleId: "example.inventory", applicationId: "parent.crm", userId: "user-7",
    });
    await mounted.dispose();
  });

  it("rejects unapproved capabilities and malformed input", async () => {
    const module = new GenericSkipoModule();
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm" },
      backend: new MockBackendFacade(),
      approvedCapabilities: ["inventory.list"],
    });
    await expect(module.requestRefund("txn-1")).rejects.toThrow(/Unauthorized capability/);
    await expect(mounted.context.backend.invoke("inventory.list", { category: 42 }))
      .rejects.toThrow(/Invalid input/);
    await expect(mounted.context.backend.invoke("inventory.reserve", { itemId: "sensor-1", quantity: 1 }))
      .rejects.toThrow(/Unauthorized capability/);
    await mounted.dispose();
  });

  it("rejects backend responses that violate the declared output schema", async () => {
    const module = new GenericSkipoModule();
    const malformedBackend: BackendFacade = {
      discoverCapabilities: () => new MockBackendFacade().discoverCapabilities(),
      invokeCapability: async () => ({ items: "not-an-array" }),
    };
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm" },
      backend: malformedBackend,
      approvedCapabilities: ["inventory.list"],
    });
    await expect(module.listInventory("hardware")).rejects.toThrow(/Invalid output/);
    await mounted.dispose();
  });

  it("discovers and activates every declared UI surface through the host mechanism", async () => {
    const module = new GenericSkipoModule();
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded",
      application: { applicationId: "parent.crm", workspaceId: "workspace-42" },
      backend: new MockBackendFacade(),
    });
    expect(module.manifest.uiSurfaces.map((surface) => surface.id)).toEqual(["overview", "activity", "settings"]);
    await expect(mounted.activateSurface("overview")).resolves.toMatchObject({ surface: "overview" });
    await expect(mounted.activateSurface("activity")).resolves.toMatchObject({
      surface: "activity", workspaceId: "workspace-42",
    });
    await expect(mounted.activateSurface("settings")).resolves.toMatchObject({
      surface: "settings", moduleId: "example.inventory",
    });
    await expect(mounted.activateSurface("missing")).rejects.toThrow(/Unknown module UI surface/);
    await mounted.dispose();
  });

  it("enforces lifecycle ordering and idempotent teardown", async () => {
    const module = new GenericSkipoModule();
    const mounted = await new SkipoModuleHost().mount(module, {
      mode: "embedded", application: { applicationId: "parent.crm" }, backend: new MockBackendFacade(),
    });
    expect(module.lifecycle).toEqual(["initialize:embedded", "mount"]);
    await mounted.unmount();
    await mounted.unmount();
    expect(mounted.state).toBe("unmounted");
    await expect(mounted.activateSurface("overview")).rejects.toThrow(/Cannot activate UI/);
    await mounted.dispose();
    await mounted.dispose();
    expect(module.lifecycle).toEqual(["initialize:embedded", "mount", "unmount", "dispose"]);
    expect(mounted.state).toBe("disposed");
  });

  it("rejects duplicate module IDs and mismatched UI declarations", () => {
    const host = new SkipoModuleHost();
    const module = new GenericSkipoModule();
    expect(() => host.discover([module, new GenericSkipoModule()])).toThrow(/Duplicate module id/);
    const invalid = new GenericSkipoModule();
    Object.defineProperty(invalid, "manifest", {
      value: { ...invalid.manifest, uiSurfaces: [] }, configurable: true,
    });
    expect(() => host.discover([invalid as unknown as SkipoModule]))
      .toThrow(/UI surface declaration\/export mismatch/);
  });

  it("fails closed when a module requests a capability absent from its parent", async () => {
    const module = new GenericSkipoModule();
    const backend = new MockBackendFacade();
    const restrictedBackend: BackendFacade = {
      discoverCapabilities: () => backend.discoverCapabilities().filter((item) => item.name !== "inventory.reserve"),
      invokeCapability: backend.invokeCapability.bind(backend),
    };
    await expect(new SkipoModuleHost().mount(module, {
      mode: "embedded", application: { applicationId: "parent.crm" }, backend: restrictedBackend,
    })).rejects.toThrow(/requests unknown capability: inventory.reserve/);
  });
});

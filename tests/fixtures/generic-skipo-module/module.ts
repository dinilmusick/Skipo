import type { ModuleRuntimeContext, SkipoModule } from "../../../src/modules/ModuleContracts.js";
import { uiSurfaces } from "./frontend.js";

export class GenericSkipoModule implements SkipoModule {
  readonly manifest = {
    id: "example.inventory", name: "Generic Inventory Example", version: "1.0.0",
    description: "Generic fixture application; no product-specific integration.",
    capabilities: ["inventory.list", "inventory.reserve"],
    uiSurfaces: uiSurfaces.map(({ id, title }) => ({ id, title })),
  };
  readonly uiSurfaces = uiSurfaces;
  readonly lifecycle: string[] = [];
  private context?: ModuleRuntimeContext;

  initialize(context: ModuleRuntimeContext): void {
    this.context = context;
    this.lifecycle.push(`initialize:${context.mode}`);
  }
  mount(context: ModuleRuntimeContext): void {
    if (!this.context || this.context.moduleId !== context.moduleId) throw new Error("Module must initialize before mounting");
    this.lifecycle.push("mount");
  }
  unmount(): void { this.lifecycle.push("unmount"); }
  dispose(): void { this.lifecycle.push("dispose"); this.context = undefined; }

  async listInventory(category: string): Promise<{ items: string[] }> {
    if (!this.context) throw new Error("Module is not initialized");
    return this.context.backend.invoke("inventory.list", { category });
  }
  async reserve(itemId: string, quantity: number): Promise<{ reservationId: string; accepted: boolean }> {
    if (!this.context) throw new Error("Module is not initialized");
    return this.context.backend.invoke("inventory.reserve", { itemId, quantity });
  }
  async requestRefund(transactionId: string): Promise<{ refunded: boolean }> {
    if (!this.context) throw new Error("Module is not initialized");
    return this.context.backend.invoke("billing.refund", { transactionId });
  }
}

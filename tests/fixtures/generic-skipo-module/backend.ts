import type { BackendFacade, CapabilityDescriptor, CapabilityInvocationContext } from "../../../src/modules/ModuleContracts.js";

const descriptors: readonly CapabilityDescriptor[] = [
  {
    name: "inventory.list", description: "List available inventory items.",
    inputSchema: { type: "object", required: ["category"], properties: { category: { type: "string" } }, additionalProperties: false },
    outputSchema: { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "string" } } }, additionalProperties: false },
  },
  {
    name: "inventory.reserve", description: "Reserve an inventory item.",
    inputSchema: { type: "object", required: ["itemId", "quantity"], properties: { itemId: { type: "string" }, quantity: { type: "integer" } }, additionalProperties: false },
    outputSchema: { type: "object", required: ["reservationId", "accepted"], properties: { reservationId: { type: "string" }, accepted: { type: "boolean" } }, additionalProperties: false },
  },
  {
    name: "billing.refund", description: "Issue a refund; intentionally not approved for this module.",
    inputSchema: { type: "object", required: ["transactionId"], properties: { transactionId: { type: "string" } }, additionalProperties: false },
    outputSchema: { type: "object", required: ["refunded"], properties: { refunded: { type: "boolean" } }, additionalProperties: false },
  },
];

export class MockBackendFacade implements BackendFacade {
  readonly calls: Array<{ name: string; input: unknown; context: CapabilityInvocationContext }> = [];
  discoverCapabilities(): readonly CapabilityDescriptor[] { return descriptors; }
  async invokeCapability(name: string, input: unknown, context: CapabilityInvocationContext): Promise<unknown> {
    this.calls.push({ name, input, context });
    if (name === "inventory.list") return { items: ["gear", "sensor", "actuator"] };
    if (name === "inventory.reserve") {
      const data = input as { itemId: string; quantity: number };
      return { reservationId: `res-${data.itemId}-${data.quantity}`, accepted: true };
    }
    if (name === "billing.refund") return { refunded: true };
    throw new Error(`Mock backend does not implement ${name}`);
  }
}

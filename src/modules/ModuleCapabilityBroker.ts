import type {
  BackendFacade, CapabilityDescriptor, CapabilityInvocationContext, DiscoveredCapability,
  JsonSchema, ModuleBackendAccess,
} from "./ModuleContracts.js";

function matchesSchema(value: unknown, schema: JsonSchema): boolean {
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if ((schema.required ?? []).some((key) => !(key in record))) return false;
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record && !matchesSchema(record[key], child)) return false;
    }
    return schema.additionalProperties !== false ||
      Object.keys(record).every((key) => key in (schema.properties ?? {}));
  }
  if (schema.type === "array") return Array.isArray(value) && (!schema.items || value.every((item) => matchesSchema(item, schema.items!)));
  if (schema.type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value);
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "boolean") return typeof value === "boolean";
  return false;
}

export class ModuleCapabilityBroker implements ModuleBackendAccess {
  private readonly descriptors: Map<string, CapabilityDescriptor>;
  private readonly approved: Set<string>;

  constructor(
    private readonly backend: BackendFacade,
    private readonly moduleId: string,
    private readonly applicationId: string,
    approvedCapabilities: readonly string[],
    private readonly userId?: string,
  ) {
    this.descriptors = new Map(backend.discoverCapabilities().map((item) => [item.name, item]));
    this.approved = new Set(approvedCapabilities);
    for (const name of this.approved) {
      if (!this.descriptors.has(name)) throw new Error(`Module ${moduleId} requests unknown capability: ${name}`);
    }
  }

  discoverCapabilities(): readonly DiscoveredCapability[] {
    return [...this.descriptors.values()].map((descriptor) => ({ ...descriptor, approved: this.approved.has(descriptor.name) }));
  }

  inspectCapability(name: string): DiscoveredCapability {
    const descriptor = this.descriptors.get(name);
    if (!descriptor) throw new Error(`Unknown backend capability: ${name}`);
    return { ...descriptor, approved: this.approved.has(name) };
  }

  async invoke<TInput = unknown, TOutput = unknown>(name: string, input: TInput): Promise<TOutput> {
    const descriptor = this.descriptors.get(name);
    if (!descriptor) throw new Error(`Unknown backend capability: ${name}`);
    if (!this.approved.has(name)) throw new Error(`Unauthorized capability: ${name}`);
    if (!matchesSchema(input, descriptor.inputSchema)) throw new Error(`Invalid input for capability: ${name}`);
    const context: CapabilityInvocationContext = {
      moduleId: this.moduleId,
      applicationId: this.applicationId,
      ...(this.userId ? { userId: this.userId } : {}),
      correlationId: `${this.moduleId}:${name}:${Date.now()}`,
    };
    const output = await this.backend.invokeCapability(name, input, context);
    if (!matchesSchema(output, descriptor.outputSchema)) throw new Error(`Invalid output returned by capability: ${name}`);
    return output as TOutput;
  }
}

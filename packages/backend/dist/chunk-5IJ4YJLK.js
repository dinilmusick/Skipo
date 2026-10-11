// src/services/ServiceBoundary.ts
import {
  createService,
  createServiceDefinition,
  createServiceProxy
} from "@dinilmusick/krnl";
function createLocalService(definition) {
  return createService(createServiceDefinition(definition));
}
function createRemoteService(definition, adapter, endpoint) {
  return createServiceProxy(definition, adapter, endpoint);
}

// src/services/CompositeBackend.ts
var CompositeBackend = class {
  id;
  name;
  version;
  services = /* @__PURE__ */ new Map();
  capabilitiesList = [];
  constructor(name, version = "1.0.0") {
    this.name = name;
    this.id = `backend-${name}`;
    this.version = version;
  }
  registerService(service) {
    this.services.set(service.name, service);
    return this;
  }
  getService(name) {
    return this.services.get(name);
  }
  getServices() {
    return Array.from(this.services.values());
  }
  registerCapability(capability) {
    if (!this.capabilitiesList.includes(capability)) {
      this.capabilitiesList.push(capability);
    }
    return this;
  }
  async start() {
    for (const service of this.services.values()) {
      await service.start();
    }
  }
  async stop() {
    for (const service of this.services.values()) {
      await service.stop();
    }
  }
  async call(op, input, ctx) {
    const firstDot = op.indexOf(".");
    if (firstDot === -1) {
      throw new Error(`[CompositeBackend] Invalid operation '${op}'. Expected 'service.operation'.`);
    }
    const serviceName = op.slice(0, firstDot);
    const operationName = op.slice(firstDot + 1);
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`[CompositeBackend] Service '${serviceName}' not registered in '${this.name}'.`);
    }
    return await service.call(operationName, input, ctx);
  }
  getState() {
    const aggregated = {};
    for (const [name, service] of this.services) {
      aggregated[name] = service.getState();
    }
    return Object.freeze(aggregated);
  }
  setState(_mutation) {
  }
  on(event, handler) {
    const [serviceName, eventName] = event.split(".");
    const service = this.services.get(serviceName);
    if (!service) return () => {
    };
    return service.on(eventName, handler);
  }
  emit(event, payload) {
    const [serviceName, eventName] = event.split(".");
    const service = this.services.get(serviceName);
    if (service) {
      service.emit(eventName, payload);
    }
  }
  getDefinition() {
    const ops = {};
    for (const service of this.services.values()) {
      const def = service.getDefinition();
      for (const [opKey, opDef] of Object.entries(def.operations)) {
        ops[`${service.name}.${opKey}`] = opDef;
      }
    }
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      operations: ops,
      capabilities: this.capabilitiesList.map((c) => ({
        id: c,
        name: c,
        protocols: ["http", "ws", "udp", "p2p"]
      })),
      protocols: ["http", "ws", "udp", "p2p"]
    };
  }
};

// src/services/EndpointGenerator.ts
var EndpointGenerator = class {
  static generateEndpoints(backend, basePort = 8e3) {
    const def = backend.getDefinition();
    const ops = Object.keys(def.operations);
    return {
      httpRoutes: ops.map((op) => `/api/${op.replace(".", "/")}`),
      wsChannels: ops.map((op) => `channel:${op}`),
      udpEndpoints: [`udp://127.0.0.1:${basePort}`],
      p2pBindings: ops.map((op) => `p2p://${backend.name}/${op}`)
    };
  }
  static generateDescriptors(backend, host = "127.0.0.1", port = 8080) {
    return [
      { protocol: "http", address: host, port, capabilities: ["requestResponse"] },
      { protocol: "ws", address: host, port, capabilities: ["requestResponse", "pubSub"] },
      { protocol: "udp", address: host, port, capabilities: ["datagram"] },
      { protocol: "p2p", address: `p2p://${backend.name}`, capabilities: ["peerToPeer"] }
    ];
  }
};

// src/services/ServiceGenerators.ts
function createBackend(name) {
  return new CompositeBackend(name);
}
function createCompositeService(name) {
  return new CompositeBackend(name);
}

export {
  createLocalService,
  createRemoteService,
  CompositeBackend,
  EndpointGenerator,
  createBackend,
  createCompositeService
};

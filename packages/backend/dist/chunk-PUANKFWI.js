import {
  IdempotencyManager,
  JobScheduler
} from "./chunk-XI5PEFAO.js";

// src/execution/OperationComponent.ts
function createOperationComponent(name, handler) {
  return {
    name,
    async execute(input) {
      try {
        return await handler(input);
      } catch (err) {
        throw new Error(
          `[OperationComponent:${name}] Execution failure: ${err?.message || String(err)}`
        );
      }
    }
  };
}

// src/execution/ServiceDispatcher.ts
var ServiceDispatcher = class {
  constructor(name) {
    this.name = name;
  }
  name;
  operations = {};
  registerOperation(opName, operation) {
    this.operations[opName] = operation;
    return this;
  }
  async execute(operationName, input) {
    const op = this.operations[operationName];
    if (!op) {
      throw new Error(
        `[ServiceDispatcher:${this.name}] Operation "${operationName}" not found.`
      );
    }
    return await op.execute(input);
  }
};

// src/execution/BackendFacade.ts
var ExecutableBackendFacade = class {
  constructor(name, idempotency) {
    this.name = name;
    this.idempotency = idempotency || new IdempotencyManager();
  }
  name;
  services = /* @__PURE__ */ new Map();
  idempotency;
  registerService(service) {
    this.services.set(service.name, service);
    return this;
  }
  async executeCommand(command, context) {
    const startTime = Date.now();
    if (!context || !context.isWorkerContext) {
      return {
        correlationId: command.correlationId,
        status: "FAILED",
        error: "[BackendFacade] DIRECT_COMPONENT -> BACKEND_FACADE is strictly FORBIDDEN. Access allowed for WORKER_ONLY.",
        executionTimestamp: startTime
      };
    }
    const runCore = async () => {
      try {
        const parts = command.type.split(".");
        if (parts.length < 2) {
          throw new Error(
            `[BackendFacade] Invalid command type "${command.type}". Expected "service.operation".`
          );
        }
        const [serviceName, operationName] = parts;
        const service = this.services.get(serviceName);
        if (!service) {
          throw new Error(`[BackendFacade] Service "${serviceName}" not registered.`);
        }
        const data = await service.execute(operationName, command.payload);
        return {
          correlationId: command.correlationId,
          status: "COMPLETED",
          data,
          executionTimestamp: Date.now()
        };
      } catch (err) {
        return {
          correlationId: command.correlationId,
          status: "FAILED",
          error: err?.message || String(err),
          executionTimestamp: Date.now()
        };
      }
    };
    if (command.idempotencyKey) {
      return await this.idempotency.executeIdempotent(command.idempotencyKey, runCore);
    }
    return await runCore();
  }
};

// src/execution/WorkerExecutionBoundary.ts
var WorkerExecutionBoundary = class {
  constructor(workerId, facade) {
    this.workerId = workerId;
    this.facade = facade;
  }
  workerId;
  facade;
  async processJob(command) {
    const context = {
      isWorkerContext: true,
      workerId: this.workerId,
      timestamp: Date.now()
    };
    return await this.facade.executeCommand(command, context);
  }
  static assertWorkerContext(context) {
    if (!context || !context.isWorkerContext) {
      throw new Error(
        "[WorkerExecutionBoundary] Violation: DIRECT_COMPONENT -> BACKEND_FACADE is forbidden. Only BullMQ Workers may execute backend commands."
      );
    }
  }
};

// src/execution/DependencyOrdering.ts
var JobDependencyGraph = class {
  scheduler;
  constructor(maxConcurrency = 5) {
    this.scheduler = new JobScheduler(maxConcurrency);
  }
  registerHandler(type, handler) {
    this.scheduler.registerHandler(type, (job) => handler(job));
    return this;
  }
  submitJob(type, payload, dependencies = [], idempotencyKey) {
    return this.scheduler.submit({
      type,
      payload,
      dependencies,
      correlationId: idempotencyKey
    });
  }
  getJob(jobId) {
    return this.scheduler.status(jobId);
  }
  clear() {
    this.scheduler.clear();
  }
};

// src/execution/ResultFlowBridge.ts
var ResultFlowBridge = class {
  static formatStateUpdate(result) {
    return {
      type: "SKIPO_STATE_UPDATE",
      correlationId: result.correlationId,
      status: result.status,
      data: result.data,
      error: result.error,
      timestamp: result.executionTimestamp
    };
  }
};

export {
  createOperationComponent,
  ServiceDispatcher,
  ExecutableBackendFacade,
  WorkerExecutionBoundary,
  JobDependencyGraph,
  ResultFlowBridge
};

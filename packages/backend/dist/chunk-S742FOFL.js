import {
  CallbackRegistry,
  EventBus
} from "./chunk-NIP22V2G.js";
import {
  JobScheduler
} from "./chunk-XI5PEFAO.js";

// src/connectivity/BackendContract.ts
function createEmptyContract(version = "1.0.0") {
  return {
    version,
    domains: {},
    capabilities: []
  };
}

// src/connectivity/BackendRegistry.ts
var BackendRegistry = class {
  contract;
  constructor(version = "1.0.0") {
    this.contract = createEmptyContract(version);
  }
  ensureDomain(domain) {
    if (!this.contract.domains[domain]) {
      this.contract.domains[domain] = {
        domain,
        commands: {},
        queries: {},
        events: {},
        callbacks: {},
        jobs: {}
      };
    }
    return this.contract.domains[domain];
  }
  registerCapability(capabilityName) {
    if (!this.contract.capabilities.includes(capabilityName)) {
      this.contract.capabilities.push(capabilityName);
    }
    return this;
  }
  registerCommand(domain, name, handler, description) {
    const d = this.ensureDomain(domain);
    d.commands[name] = { domain, name, handler, description };
    return this;
  }
  registerQuery(domain, name, handler, description) {
    const d = this.ensureDomain(domain);
    d.queries[name] = { domain, name, handler, description };
    return this;
  }
  registerEvent(domain, name, description) {
    const d = this.ensureDomain(domain);
    d.events[name] = { domain, name, description };
    return this;
  }
  registerCallback(domain, name, handler, description) {
    const d = this.ensureDomain(domain);
    d.callbacks[name] = { domain, name, handler, description };
    return this;
  }
  registerJob(domain, type, handler, description) {
    const d = this.ensureDomain(domain);
    d.jobs[type] = { domain, type, handler, description };
    return this;
  }
  getCommand(domain, name) {
    return this.contract.domains[domain]?.commands[name];
  }
  getQuery(domain, name) {
    return this.contract.domains[domain]?.queries[name];
  }
  getJob(domain, type) {
    return this.contract.domains[domain]?.jobs[type];
  }
  exposeContract() {
    const sanitized = {
      version: this.contract.version,
      capabilities: [...this.contract.capabilities],
      domains: {}
    };
    for (const [domName, dom] of Object.entries(this.contract.domains)) {
      sanitized.domains[domName] = {
        domain: domName,
        commands: Object.fromEntries(
          Object.entries(dom.commands).map(([k, v]) => [k, { name: v.name, domain: v.domain, description: v.description }])
        ),
        queries: Object.fromEntries(
          Object.entries(dom.queries).map(([k, v]) => [k, { name: v.name, domain: v.domain, description: v.description }])
        ),
        events: { ...dom.events },
        callbacks: Object.fromEntries(
          Object.entries(dom.callbacks).map(([k, v]) => [k, { name: v.name, domain: v.domain, description: v.description }])
        ),
        jobs: Object.fromEntries(
          Object.entries(dom.jobs).map(([k, v]) => [k, { type: v.type, domain: v.domain, description: v.description }])
        )
      };
    }
    return sanitized;
  }
};

// src/connectivity/ConcurrencyManager.ts
var ConcurrencyConflictError = class extends Error {
  constructor(resourceId, expectedVersion, actualVersion) {
    super(
      `[ConcurrencyConflictError] Version conflict on resource "${resourceId}": expected v${expectedVersion}, actual v${actualVersion}.`
    );
    this.resourceId = resourceId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
    this.name = "ConcurrencyConflictError";
  }
  resourceId;
  expectedVersion;
  actualVersion;
};
var ConcurrencyManager = class {
  versions = /* @__PURE__ */ new Map();
  stateStore = /* @__PURE__ */ new Map();
  getVersion(resourceId) {
    return this.versions.get(resourceId)?.version ?? 0;
  }
  setVersion(resourceId, version) {
    const rv = {
      version,
      updatedAt: Date.now()
    };
    this.versions.set(resourceId, rv);
    return rv;
  }
  compareAndSwap(resourceId, expectedVersion, newValue) {
    const currentRv = this.versions.get(resourceId);
    const actualVersion = currentRv?.version ?? 0;
    if (actualVersion !== expectedVersion) {
      return {
        success: false,
        newVersion: actualVersion,
        previousValue: this.stateStore.get(resourceId)
      };
    }
    const nextVersion = actualVersion + 1;
    this.versions.set(resourceId, {
      version: nextVersion,
      updatedAt: Date.now()
    });
    this.stateStore.set(resourceId, newValue);
    return {
      success: true,
      newVersion: nextVersion,
      previousValue: newValue
    };
  }
  async optimisticUpdate(resourceId, expectedVersion, mutation) {
    const currentRv = this.versions.get(resourceId);
    const actualVersion = currentRv?.version ?? 0;
    if (actualVersion !== expectedVersion) {
      throw new ConcurrencyConflictError(resourceId, expectedVersion, actualVersion);
    }
    const result = await mutation();
    const cas = this.compareAndSwap(resourceId, expectedVersion, result);
    if (!cas.success) {
      throw new ConcurrencyConflictError(resourceId, expectedVersion, cas.newVersion);
    }
    return {
      result,
      newVersion: cas.newVersion
    };
  }
  getState(resourceId) {
    return this.stateStore.get(resourceId);
  }
  clear() {
    this.versions.clear();
    this.stateStore.clear();
  }
};

// src/connectivity/LockManager.ts
var LockManager = class {
  locks = /* @__PURE__ */ new Map();
  defaultTimeoutMs;
  constructor(defaultTimeoutMs = 1e4) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }
  getState(key) {
    let state = this.locks.get(key);
    if (!state) {
      state = { locked: false, waiters: [] };
      this.locks.set(key, state);
    }
    return state;
  }
  async acquire(key, ownerId = "local-worker", timeoutMs) {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const state = this.getState(key);
    if (!state.locked) {
      state.locked = true;
      state.ownerId = ownerId;
      state.lease = {
        key,
        ownerId,
        leaseId: `lease-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        expiration: Date.now() + timeout
      };
      return this.createRelease(key, state.lease.leaseId);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject
      };
      waiter.timer = setTimeout(() => {
        const idx = state.waiters.indexOf(waiter);
        if (idx !== -1) state.waiters.splice(idx, 1);
        reject(new Error(`[LockManager] Lock acquisition timed out for key "${key}" after ${timeout}ms.`));
      }, timeout);
      state.waiters.push(waiter);
    });
  }
  createRelease(key, leaseId) {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(key, leaseId);
    };
  }
  release(key, leaseId) {
    const state = this.locks.get(key);
    if (!state || !state.locked) return;
    if (leaseId && state.lease && state.lease.leaseId !== leaseId) {
      console.warn(`[LockManager] Stale lease release ignored for key "${key}".`);
      return;
    }
    const nextWaiter = state.waiters.shift();
    if (nextWaiter) {
      if (nextWaiter.timer) clearTimeout(nextWaiter.timer);
      const newLeaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.lease = {
        key,
        ownerId: state.ownerId || "next-worker",
        leaseId: newLeaseId,
        expiration: Date.now() + this.defaultTimeoutMs
      };
      nextWaiter.resolve(this.createRelease(key, newLeaseId));
    } else {
      state.locked = false;
      state.ownerId = void 0;
      state.lease = void 0;
      this.locks.delete(key);
    }
  }
  async withLock(key, operation, timeoutMs) {
    const release = await this.acquire(key, "with-lock-worker", timeoutMs);
    try {
      return await operation();
    } finally {
      release();
    }
  }
  isLocked(key) {
    const state = this.locks.get(key);
    if (!state || !state.locked) return false;
    if (state.lease && Date.now() > state.lease.expiration) {
      this.release(key);
      return false;
    }
    return true;
  }
  clear() {
    for (const state of this.locks.values()) {
      for (const w of state.waiters) {
        if (w.timer) clearTimeout(w.timer);
        w.reject(new Error("[LockManager] Lock manager cleared."));
      }
    }
    this.locks.clear();
  }
};

// src/connectivity/HealthMonitor.ts
var HealthMonitor = class {
  instances = /* @__PURE__ */ new Map();
  staleThresholdMs;
  constructor(staleThresholdMs = 3e4) {
    this.staleThresholdMs = staleThresholdMs;
  }
  registerInstance(instance) {
    const full = {
      ...instance,
      lastHeartbeat: Date.now()
    };
    this.instances.set(full.id, full);
    return full;
  }
  recordHeartbeat(instanceId, metrics) {
    const inst = this.instances.get(instanceId);
    if (!inst) return;
    inst.lastHeartbeat = Date.now();
    inst.healthy = true;
    if (metrics) {
      if (metrics.capacity !== void 0) inst.capacity = metrics.capacity;
      if (metrics.activeJobs !== void 0) inst.activeJobs = metrics.activeJobs;
      if (metrics.activeConnections !== void 0) inst.activeConnections = metrics.activeConnections;
      if (metrics.latencyMs !== void 0) inst.latencyMs = metrics.latencyMs;
    }
  }
  markUnhealthy(instanceId, reason) {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.healthy = false;
      if (reason) {
        console.warn(`[HealthMonitor] Instance "${instanceId}" marked unhealthy: ${reason}`);
      }
    }
  }
  markHealthy(instanceId) {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.healthy = true;
      inst.lastHeartbeat = Date.now();
    }
  }
  getHealthyInstances() {
    const now = Date.now();
    return Array.from(this.instances.values()).filter((inst) => {
      if (!inst.healthy) return false;
      if (now - inst.lastHeartbeat > this.staleThresholdMs) {
        inst.healthy = false;
        return false;
      }
      return true;
    });
  }
  getInstance(id) {
    return this.instances.get(id);
  }
  removeInstance(id) {
    return this.instances.delete(id);
  }
  clear() {
    this.instances.clear();
  }
};

// src/connectivity/LoadBalancer.ts
var LoadBalancer = class {
  healthMonitor;
  defaultStrategy;
  roundRobinIndex = 0;
  constructor(healthMonitor, defaultStrategy = "roundRobin") {
    this.healthMonitor = healthMonitor || new HealthMonitor();
    this.defaultStrategy = defaultStrategy;
  }
  getHealthMonitor() {
    return this.healthMonitor;
  }
  selectInstance(strategy) {
    const instances = this.healthMonitor.getHealthyInstances();
    if (instances.length === 0) {
      throw new Error("[LoadBalancer] No healthy backend instances available.");
    }
    const strat = strategy || this.defaultStrategy;
    switch (strat) {
      case "leastConnections":
        return instances.reduce(
          (prev, curr) => curr.activeConnections < prev.activeConnections ? curr : prev
        );
      case "latencyAware":
        return instances.reduce(
          (prev, curr) => curr.latencyMs < prev.latencyMs ? curr : prev
        );
      case "capacityAware":
        return instances.reduce(
          (prev, curr) => curr.capacity - curr.activeJobs > prev.capacity - prev.activeJobs ? curr : prev
        );
      case "weighted": {
        const totalWeight = instances.reduce((acc, i) => acc + (i.weight || 1), 0);
        let random = Math.random() * totalWeight;
        for (const inst of instances) {
          random -= inst.weight || 1;
          if (random <= 0) return inst;
        }
        return instances[0];
      }
      case "roundRobin":
      default: {
        const selected = instances[this.roundRobinIndex % instances.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
        return selected;
      }
    }
  }
  async executeWithFailover(operation, maxRetries = 2) {
    const triedInstances = /* @__PURE__ */ new Set();
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let instance;
      try {
        instance = this.selectInstance();
        if (triedInstances.has(instance.id)) {
          const healthy = this.healthMonitor.getHealthyInstances();
          const untried = healthy.find((i) => !triedInstances.has(i.id));
          if (untried) instance = untried;
        }
      } catch (err) {
        throw lastError || err;
      }
      triedInstances.add(instance.id);
      instance.activeConnections++;
      try {
        const result = await operation(instance);
        instance.activeConnections = Math.max(0, instance.activeConnections - 1);
        return result;
      } catch (err) {
        instance.activeConnections = Math.max(0, instance.activeConnections - 1);
        lastError = err;
        this.healthMonitor.markUnhealthy(instance.id, err?.message || String(err));
      }
    }
    throw lastError || new Error("[LoadBalancer] All failover attempts exhausted.");
  }
};

// src/connectivity/InProcessExecutor.ts
var InProcessExecutor = class {
  registry;
  eventBus;
  callbackRegistry;
  jobScheduler;
  constructor(registry, eventBus, callbackRegistry, jobScheduler) {
    this.registry = registry || new BackendRegistry();
    this.eventBus = eventBus || new EventBus();
    this.callbackRegistry = callbackRegistry || new CallbackRegistry();
    this.jobScheduler = jobScheduler || new JobScheduler();
  }
  getRegistry() {
    return this.registry;
  }
  getEventBus() {
    return this.eventBus;
  }
  getCallbackRegistry() {
    return this.callbackRegistry;
  }
  getJobScheduler() {
    return this.jobScheduler;
  }
  async execute(command) {
    const parts = command.operation.split(".");
    const domain = parts[0];
    const opName = parts.slice(1).join(".");
    const def = this.registry.getCommand(domain, opName);
    if (!def || !def.handler) {
      throw new Error(`[InProcessExecutor] Command not found: "${command.operation}" in domain "${domain}".`);
    }
    return await def.handler(command.payload, command);
  }
  async query(query) {
    const parts = query.operation.split(".");
    const domain = parts[0];
    const opName = parts.slice(1).join(".");
    const def = this.registry.getQuery(domain, opName);
    if (!def || !def.handler) {
      throw new Error(`[InProcessExecutor] Query not found: "${query.operation}" in domain "${domain}".`);
    }
    return await def.handler(query.payload, query);
  }
  subscribe(channel, handler) {
    return this.eventBus.subscribe(channel, handler);
  }
  async emit(event) {
    this.eventBus.emit(event);
  }
  registerCallback(callback) {
    return this.callbackRegistry.register(callback);
  }
  async delegate(delegation) {
    if (delegation.callbackHandle) {
      return await this.callbackRegistry.invoke(
        delegation.callbackHandle,
        [delegation.payload],
        delegation.sessionId
      );
    }
    return await this.execute({
      id: `del-${Date.now()}`,
      type: "COMMAND",
      operation: `${delegation.target}.${delegation.operation}`,
      payload: delegation.payload,
      sessionId: delegation.sessionId,
      correlationId: delegation.correlationId,
      timestamp: Date.now()
    });
  }
  async submitJob(job) {
    if (!job.type) {
      throw new Error('[InProcessExecutor] Job submission requires a valid "type".');
    }
    return this.jobScheduler.submit(job);
  }
};

// src/connectivity/RemoteExecutor.ts
var RemoteExecutor = class {
  transport;
  loadBalancer;
  callbackRegistry;
  sessionId;
  constructor(options) {
    this.transport = options.transport;
    this.loadBalancer = options.loadBalancer;
    this.callbackRegistry = options.callbackRegistry || new CallbackRegistry();
    this.sessionId = options.sessionId || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.initCallbackListener();
  }
  initCallbackListener() {
    this.transport.onMessage(async (msg) => {
      if (msg.type === "CALLBACK_REQUEST" && msg.payload) {
        const { handle, args } = msg.payload;
        try {
          const result = await this.callbackRegistry.invoke(handle, args, this.sessionId);
          await this.transport.send({
            id: `cb-res-${Date.now()}`,
            type: "CALLBACK_RESULT",
            operation: msg.operation,
            correlationId: msg.id,
            sessionId: this.sessionId,
            payload: result,
            timestamp: Date.now()
          });
        } catch (err) {
          await this.transport.send({
            id: `cb-err-${Date.now()}`,
            type: "ERROR",
            operation: msg.operation,
            correlationId: msg.id,
            sessionId: this.sessionId,
            error: { code: "CALLBACK_FAILED", message: err?.message || String(err) },
            timestamp: Date.now()
          });
        }
      }
    });
  }
  prepareMessage(type, operation, payload) {
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      type,
      operation,
      payload,
      sessionId: this.sessionId,
      correlationId: id,
      timestamp: Date.now()
    };
  }
  async execute(command) {
    const msg = this.prepareMessage("COMMAND", command.operation, command.payload);
    const res = await this.transport.request(msg);
    if (res.type === "ERROR") {
      throw new Error(res.error?.message || `Command "${command.operation}" failed.`);
    }
    return res.payload;
  }
  async query(query) {
    const msg = this.prepareMessage("QUERY", query.operation, query.payload);
    const res = await this.transport.request(msg);
    if (res.type === "ERROR") {
      throw new Error(res.error?.message || `Query "${query.operation}" failed.`);
    }
    return res.payload;
  }
  subscribe(channel, handler) {
    return this.transport.subscribe(channel, handler);
  }
  async emit(event) {
    const msg = this.prepareMessage("EVENT", event.operation, event.payload);
    await this.transport.send(msg);
  }
  registerCallback(callback) {
    return this.callbackRegistry.register(callback, this.sessionId);
  }
  async delegate(delegation) {
    const msg = this.prepareMessage("COMMAND", `${delegation.target}.${delegation.operation}`, delegation);
    const res = await this.transport.request(msg);
    return res.payload;
  }
  async submitJob(job) {
    const msg = this.prepareMessage("JOB_SUBMIT", `jobs.submit`, job);
    const res = await this.transport.request(msg);
    return res.payload;
  }
  getSessionId() {
    return this.sessionId;
  }
  getLoadBalancer() {
    return this.loadBalancer;
  }
  getTransport() {
    return this.transport;
  }
};

export {
  createEmptyContract,
  BackendRegistry,
  ConcurrencyConflictError,
  ConcurrencyManager,
  LockManager,
  HealthMonitor,
  LoadBalancer,
  InProcessExecutor,
  RemoteExecutor
};

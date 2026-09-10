// src/connectivity/EventBus.ts
var EventBus = class {
  listeners = /* @__PURE__ */ new Map();
  buffer = [];
  maxBufferSize = 500;
  sequenceCounter = 0;
  emit(eventOrType, payload) {
    let event;
    if (typeof eventOrType === "string") {
      this.sequenceCounter++;
      event = {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "EVENT",
        operation: eventOrType,
        payload,
        sequence: this.sequenceCounter,
        timestamp: Date.now()
      };
    } else {
      this.sequenceCounter = Math.max(this.sequenceCounter + 1, eventOrType.sequence || this.sequenceCounter + 1);
      event = {
        ...eventOrType,
        sequence: eventOrType.sequence ?? this.sequenceCounter,
        timestamp: eventOrType.timestamp || Date.now()
      };
    }
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
    const directSubs = this.listeners.get(event.operation);
    if (directSubs) {
      for (const sub of directSubs) {
        try {
          sub.handler(event);
        } catch (err) {
          console.error(`[EventBus] Error in subscriber ${sub.id} for ${event.operation}:`, err);
        }
      }
    }
    const wildcardSubs = this.listeners.get("*");
    if (wildcardSubs) {
      for (const sub of wildcardSubs) {
        try {
          sub.handler(event);
        } catch (err) {
          console.error(`[EventBus] Error in wildcard subscriber ${sub.id}:`, err);
        }
      }
    }
    return event;
  }
  subscribe(channel, handler) {
    const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, /* @__PURE__ */ new Set());
    }
    const set = this.listeners.get(channel);
    set.add({ id: subId, handler });
    return () => {
      this.unsubscribe(channel, subId);
    };
  }
  unsubscribe(channel, subscriptionId) {
    const set = this.listeners.get(channel);
    if (set) {
      for (const item of set) {
        if (item.id === subscriptionId) {
          set.delete(item);
          break;
        }
      }
      if (set.size === 0) {
        this.listeners.delete(channel);
      }
    }
  }
  getBuffer(sinceSequence = 0, channel) {
    return this.buffer.filter((e) => {
      if ((e.sequence || 0) <= sinceSequence) return false;
      if (channel && channel !== "*" && e.operation !== channel) return false;
      return true;
    });
  }
  getCurrentSequence() {
    return this.sequenceCounter;
  }
  clear() {
    this.listeners.clear();
    this.buffer = [];
    this.sequenceCounter = 0;
  }
};

// src/connectivity/CallbackRegistry.ts
var CallbackRegistry = class {
  entries = /* @__PURE__ */ new Map();
  defaultTtlMs;
  constructor(defaultTtlMs = 3e5) {
    this.defaultTtlMs = defaultTtlMs;
  }
  register(fn, sessionId = "default-session", capability = "delegation", ttlMs) {
    const id = `cb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const expiration = Date.now() + (ttlMs || this.defaultTtlMs);
    const handle = {
      id,
      sessionId,
      capability,
      expiration
    };
    this.entries.set(id, { handle, fn });
    return handle;
  }
  async invoke(handle, args, callerSessionId) {
    const handleId = typeof handle === "string" ? handle : handle.id;
    const entry = this.entries.get(handleId);
    if (!entry) {
      throw new Error(`[CallbackRegistry] Callback handle "${handleId}" not found or expired.`);
    }
    if (Date.now() > entry.handle.expiration) {
      this.entries.delete(handleId);
      throw new Error(`[CallbackRegistry] Callback handle "${handleId}" has expired.`);
    }
    if (callerSessionId && callerSessionId !== entry.handle.sessionId) {
      throw new Error(
        `[CallbackRegistry] Unauthorized callback invocation: session mismatch (${callerSessionId} vs ${entry.handle.sessionId}).`
      );
    }
    return await entry.fn(...args);
  }
  unregister(handleOrId) {
    const id = typeof handleOrId === "string" ? handleOrId : handleOrId.id;
    return this.entries.delete(id);
  }
  expire(handleOrId) {
    const id = typeof handleOrId === "string" ? handleOrId : handleOrId.id;
    const entry = this.entries.get(id);
    if (entry) {
      entry.handle.expiration = 0;
      this.entries.delete(id);
    }
  }
  pruneExpired() {
    const now = Date.now();
    let pruned = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (now > entry.handle.expiration) {
        this.entries.delete(id);
        pruned++;
      }
    }
    return pruned;
  }
  clear() {
    this.entries.clear();
  }
};

// src/connectivity/SequenceTracker.ts
var SequenceTracker = class {
  lastSequences = /* @__PURE__ */ new Map();
  pausedStreams = /* @__PURE__ */ new Set();
  gapHandlers = [];
  record(streamKey, sequence) {
    const last = this.lastSequences.get(streamKey) ?? 0;
    const expected = last + 1;
    if (sequence <= last) {
      return {
        valid: false,
        isDuplicate: sequence === last,
        isOutOfOrder: sequence < last,
        hasGap: false,
        expected,
        received: sequence
      };
    }
    if (sequence > expected) {
      this.pause(streamKey);
      this.triggerGap(streamKey, expected, sequence);
      return {
        valid: false,
        isDuplicate: false,
        isOutOfOrder: false,
        hasGap: true,
        expected,
        received: sequence
      };
    }
    this.lastSequences.set(streamKey, sequence);
    return {
      valid: true,
      isDuplicate: false,
      isOutOfOrder: false,
      hasGap: false,
      expected,
      received: sequence
    };
  }
  onGap(handler) {
    this.gapHandlers.push(handler);
    return () => {
      const idx = this.gapHandlers.indexOf(handler);
      if (idx !== -1) this.gapHandlers.splice(idx, 1);
    };
  }
  triggerGap(streamKey, expected, received) {
    for (const h of this.gapHandlers) {
      try {
        h(streamKey, expected, received);
      } catch (err) {
        console.error(`[SequenceTracker] Error in gap handler for ${streamKey}:`, err);
      }
    }
  }
  pause(streamKey) {
    this.pausedStreams.add(streamKey);
  }
  resume(streamKey, authoritativeSequence) {
    this.pausedStreams.delete(streamKey);
    if (authoritativeSequence !== void 0) {
      this.lastSequences.set(streamKey, authoritativeSequence);
    }
  }
  isPaused(streamKey) {
    return this.pausedStreams.has(streamKey);
  }
  getLastSequence(streamKey) {
    return this.lastSequences.get(streamKey) ?? 0;
  }
  reset(streamKey) {
    if (streamKey) {
      this.lastSequences.delete(streamKey);
      this.pausedStreams.delete(streamKey);
    } else {
      this.lastSequences.clear();
      this.pausedStreams.clear();
    }
  }
};

// src/connectivity/HTTPTransport.ts
var HTTPTransport = class {
  baseUrl;
  defaultHeaders;
  timeoutMs;
  eventsPath;
  connected = false;
  messageHandlers = /* @__PURE__ */ new Set();
  errorHandlers = /* @__PURE__ */ new Set();
  eventSourceAbort;
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.defaultHeaders = options.defaultHeaders || {};
    this.timeoutMs = options.timeoutMs || 3e4;
    this.eventsPath = options.eventsPath || "/api/events";
  }
  async connect() {
    this.connected = true;
    this.startEventStream();
  }
  async disconnect() {
    this.connected = false;
    if (this.eventSourceAbort) {
      this.eventSourceAbort.abort();
      this.eventSourceAbort = void 0;
    }
  }
  isConnected() {
    return this.connected;
  }
  async request(message) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = {
      "Content-Type": "application/json",
      "x-request-id": message.id,
      ...this.defaultHeaders
    };
    if (message.sessionId) headers["x-session-id"] = message.sessionId;
    if (message.correlationId) headers["x-correlation-id"] = message.correlationId;
    try {
      const endpoint = `${this.baseUrl}/api/${message.operation.replace(/\./g, "/")}`;
      const res = await fetch(endpoint, {
        method: message.type === "QUERY" ? "POST" : "POST",
        headers,
        body: JSON.stringify(message.payload ?? {}),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const json = await res.json();
          errMsg = json?.message || json?.error || errMsg;
        } catch {
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      return {
        id: `res-${Date.now()}`,
        type: "RESULT",
        operation: message.operation,
        payload: data,
        sessionId: message.sessionId,
        correlationId: message.correlationId,
        timestamp: Date.now()
      };
    } catch (err) {
      clearTimeout(timer);
      const error = new Error(`[HTTPTransport] Request failed: ${err.message || String(err)}`);
      this.notifyError(error);
      throw error;
    }
  }
  async send(message) {
    await this.request(message);
  }
  subscribe(_channel, handler) {
    if (handler) this.messageHandlers.add(handler);
    return () => {
      if (handler) this.messageHandlers.delete(handler);
    };
  }
  unsubscribe(_channel) {
  }
  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }
  onError(handler) {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }
  notifyError(err) {
    for (const h of this.errorHandlers) {
      try {
        h(err);
      } catch {
      }
    }
  }
  startEventStream() {
    if (typeof globalThis.fetch === "undefined") return;
    this.eventSourceAbort = new AbortController();
    (async () => {
      try {
        const streamUrl = `${this.baseUrl}${this.eventsPath}?stream=true`;
        const res = await fetch(streamUrl, {
          headers: { Accept: "text/event-stream", ...this.defaultHeaders },
          signal: this.eventSourceAbort?.signal
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (this.connected) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";
          for (const block of lines) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
            if (dataLine) {
              try {
                const parsed = JSON.parse(dataLine.slice(6));
                for (const h of this.messageHandlers) h(parsed);
              } catch {
              }
            }
          }
        }
      } catch (err) {
        if (this.connected && err.name !== "AbortError") {
          this.notifyError(err);
        }
      }
    })();
  }
};

// src/connectivity/WebSocketTransport.ts
var WebSocketTransport = class {
  url;
  ws = null;
  connected = false;
  messageHandlers = /* @__PURE__ */ new Set();
  errorHandlers = /* @__PURE__ */ new Set();
  pendingRequests = /* @__PURE__ */ new Map();
  heartbeatTimer = null;
  heartbeatIntervalMs;
  reconnectDelayMs;
  constructor(options) {
    this.url = options.url;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 15e3;
    this.reconnectDelayMs = options.reconnectDelayMs || 2e3;
  }
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const WSClass = globalThis.WebSocket;
        if (!WSClass) {
          throw new Error("WebSocket is not supported in this runtime environment.");
        }
        this.ws = new WSClass(this.url);
        this.ws.onopen = () => {
          this.connected = true;
          this.startHeartbeat();
          resolve();
        };
        this.ws.onclose = () => {
          this.connected = false;
          this.stopHeartbeat();
        };
        this.ws.onerror = (event) => {
          const err = new Error(`[WebSocketTransport] Socket error: ${event.message || "unknown"}`);
          for (const h of this.errorHandlers) h(err);
          if (!this.connected) reject(err);
        };
        this.ws.onmessage = (event) => {
          try {
            const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
            if (data.type === "PONG") return;
            if (data.correlationId && this.pendingRequests.has(data.correlationId)) {
              const pending = this.pendingRequests.get(data.correlationId);
              this.pendingRequests.delete(data.correlationId);
              if (data.type === "ERROR") {
                pending.reject(new Error(data.error?.message || "Remote error"));
              } else {
                pending.resolve(data);
              }
              return;
            }
            for (const h of this.messageHandlers) h(data);
          } catch {
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  async disconnect() {
    this.connected = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  isConnected() {
    return this.connected;
  }
  async request(message) {
    if (!this.connected || !this.ws) {
      throw new Error("[WebSocketTransport] Cannot send request: WebSocket is not connected.");
    }
    const corrId = message.id || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const outgoing = { ...message, id: corrId, correlationId: corrId };
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(corrId, { resolve, reject });
      this.ws.send(JSON.stringify(outgoing));
    });
  }
  async send(message) {
    if (!this.connected || !this.ws) {
      throw new Error("[WebSocketTransport] Cannot send message: WebSocket is not connected.");
    }
    this.ws.send(JSON.stringify(message));
  }
  subscribe(channel, handler) {
    if (handler) this.messageHandlers.add(handler);
    this.send({
      id: `sub-${Date.now()}`,
      type: "COMMAND",
      operation: "system.subscribe",
      payload: { channel },
      timestamp: Date.now()
    }).catch(() => {
    });
    return () => {
      if (handler) this.messageHandlers.delete(handler);
      this.unsubscribe(channel);
    };
  }
  unsubscribe(channel) {
    if (this.connected) {
      this.send({
        id: `unsub-${Date.now()}`,
        type: "COMMAND",
        operation: "system.unsubscribe",
        payload: { channel },
        timestamp: Date.now()
      }).catch(() => {
      });
    }
  }
  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }
  onError(handler) {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.scheduleNextHeartbeat();
  }
  scheduleNextHeartbeat() {
    if (!this.connected) return;
    this.heartbeatTimer = setTimeout(() => {
      if (this.connected && this.ws) {
        this.ws.send(JSON.stringify({ type: "PING", timestamp: Date.now() }));
        this.scheduleNextHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  getReconnectDelay() {
    return this.reconnectDelayMs;
  }
};

// src/connectivity/BackendResolver.ts
var BackendResolver = class {
  strategy;
  inProcessExecutor;
  remoteExecutor;
  remoteHealthCheck;
  activeExecutor;
  constructor(options) {
    this.strategy = options.strategy || "LOCAL_FIRST";
    this.inProcessExecutor = options.inProcessExecutor;
    this.remoteExecutor = options.remoteExecutor;
    this.remoteHealthCheck = options.remoteHealthCheck;
    if (this.strategy === "LOCAL" && this.inProcessExecutor) {
      this.activeExecutor = this.inProcessExecutor;
    }
  }
  setInProcessExecutor(executor) {
    this.inProcessExecutor = executor;
  }
  setRemoteExecutor(executor) {
    this.remoteExecutor = executor;
  }
  setStrategy(strategy) {
    this.strategy = strategy;
    this.activeExecutor = void 0;
  }
  getStrategy() {
    return this.strategy;
  }
  getActiveExecutor() {
    return this.activeExecutor;
  }
  async resolve() {
    if (this.activeExecutor) return this.activeExecutor;
    switch (this.strategy) {
      case "LOCAL":
        if (!this.inProcessExecutor) {
          throw new Error("[BackendResolver] LOCAL strategy selected but no InProcessExecutor configured.");
        }
        this.activeExecutor = this.inProcessExecutor;
        return this.activeExecutor;
      case "REMOTE":
        if (!this.remoteExecutor) {
          throw new Error("[BackendResolver] REMOTE strategy selected but no RemoteExecutor configured.");
        }
        this.activeExecutor = this.remoteExecutor;
        return this.activeExecutor;
      case "REMOTE_FIRST": {
        const isRemoteHealthy = await this.checkRemoteHealth();
        if (isRemoteHealthy && this.remoteExecutor) {
          this.activeExecutor = this.remoteExecutor;
        } else if (this.inProcessExecutor) {
          console.warn("[BackendResolver] Remote unavailable, falling back to InProcessExecutor.");
          this.activeExecutor = this.inProcessExecutor;
        } else {
          throw new Error("[BackendResolver] REMOTE_FIRST failed: neither remote nor in-process executors are available.");
        }
        return this.activeExecutor;
      }
      case "LOCAL_FIRST":
      default: {
        if (this.inProcessExecutor) {
          this.activeExecutor = this.inProcessExecutor;
        } else if (this.remoteExecutor) {
          const isRemoteHealthy = await this.checkRemoteHealth();
          if (isRemoteHealthy) {
            this.activeExecutor = this.remoteExecutor;
          } else {
            throw new Error("[BackendResolver] LOCAL_FIRST failed: local missing and remote unhealthy.");
          }
        } else {
          throw new Error("[BackendResolver] No executor configured.");
        }
        return this.activeExecutor;
      }
    }
  }
  async checkRemoteHealth() {
    if (!this.remoteExecutor) return false;
    if (!this.remoteHealthCheck) return true;
    try {
      return await this.remoteHealthCheck();
    } catch {
      return false;
    }
  }
  async failover() {
    if (this.activeExecutor === this.remoteExecutor && this.inProcessExecutor) {
      console.warn("[BackendResolver] Failover: switching from Remote to InProcessExecutor.");
      this.activeExecutor = this.inProcessExecutor;
      return this.activeExecutor;
    }
    if (this.activeExecutor === this.inProcessExecutor && this.remoteExecutor) {
      console.warn("[BackendResolver] Failover: switching from InProcess to RemoteExecutor.");
      this.activeExecutor = this.remoteExecutor;
      return this.activeExecutor;
    }
    throw new Error("[BackendResolver] Cannot failover: no alternative executor available.");
  }
  async reconnect() {
    this.activeExecutor = void 0;
    await this.resolve();
  }
  async health() {
    const remoteOk = await this.checkRemoteHealth();
    return {
      local: !!this.inProcessExecutor,
      remote: remoteOk,
      active: this.strategy
    };
  }
};

// src/connectivity/FrontendSession.ts
var FrontendSession = class {
  sessionId;
  credentials;
  capabilities;
  callbackRegistry;
  sequenceTracker;
  subscriptions = /* @__PURE__ */ new Set();
  constructor(options = {}) {
    this.sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.credentials = { ...options.credentials || {} };
    this.capabilities = new Set(options.capabilities || []);
    this.callbackRegistry = options.callbackRegistry || new CallbackRegistry();
    this.sequenceTracker = options.sequenceTracker || new SequenceTracker();
  }
  setCredential(key, value) {
    this.credentials[key] = value;
    return this;
  }
  getCredential(key) {
    return this.credentials[key];
  }
  getCredentials() {
    return { ...this.credentials };
  }
  grantCapability(capability) {
    this.capabilities.add(capability);
    return this;
  }
  hasCapability(capability) {
    return this.capabilities.has(capability) || this.capabilities.has("*");
  }
  trackSubscription(cleanup) {
    this.subscriptions.add(cleanup);
    return () => {
      this.subscriptions.delete(cleanup);
      cleanup();
    };
  }
  clearSubscriptions() {
    for (const cleanup of this.subscriptions) {
      try {
        cleanup();
      } catch {
      }
    }
    this.subscriptions.clear();
  }
  dispose() {
    this.clearSubscriptions();
    this.callbackRegistry.clear();
    this.sequenceTracker.reset();
  }
};

// src/connectivity/BackendClient.ts
var BackendClient = class {
  resolver;
  session;
  domainProxies = /* @__PURE__ */ new Map();
  constructor(options) {
    this.resolver = options.resolver;
    this.session = options.session || new FrontendSession();
    return new Proxy(this, {
      get: (target, prop) => {
        if (typeof prop === "symbol" || prop in target) {
          return target[prop];
        }
        return target.domain(String(prop));
      }
    });
  }
  domain(domainName) {
    if (!this.domainProxies.has(domainName)) {
      const proxy = this.createDomainProxy(domainName);
      this.domainProxies.set(domainName, proxy);
    }
    return this.domainProxies.get(domainName);
  }
  createDomainProxy(domain) {
    const handler = {
      on: (event, fn) => {
        return this.on(`${domain}.${event}`, fn);
      },
      subscribe: (channel, fn) => {
        return this.subscribe(channel.includes(".") ? channel : `${domain}.${channel}`, fn);
      },
      execute: async (op, payload) => {
        const executor = await this.resolver.resolve();
        return await executor.execute({
          id: `cmd-${Date.now()}`,
          type: "COMMAND",
          operation: `${domain}.${op}`,
          payload,
          sessionId: this.session.sessionId,
          timestamp: Date.now()
        });
      },
      delegate: async (op, payload, callback) => {
        const executor = await this.resolver.resolve();
        let callbackHandle;
        if (callback) {
          callbackHandle = executor.registerCallback(callback);
        }
        const delegation = {
          target: domain,
          operation: op,
          payload,
          callbackHandle,
          sessionId: this.session.sessionId
        };
        return await executor.delegate(delegation);
      }
    };
    return new Proxy(handler, {
      get: (target, prop) => {
        if (typeof prop === "symbol" || prop in target) {
          return target[prop];
        }
        return async (payload) => {
          return await target.execute(String(prop), payload);
        };
      }
    });
  }
  on(eventPattern, handler) {
    let cleanup;
    let cancelled = false;
    const attach = (executor) => {
      if (cancelled) return;
      cleanup = executor.subscribe(eventPattern, handler);
      this.session.trackSubscription(cleanup);
    };
    const active = this.resolver.getActiveExecutor();
    if (active) {
      attach(active);
    } else {
      this.resolver.resolve().then(attach);
    }
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }
  subscribe(channel, handler) {
    return this.on(channel, handler);
  }
  get jobs() {
    return {
      submit: async (job) => {
        const executor = await this.resolver.resolve();
        return await executor.submitJob({
          ...job,
          sessionId: this.session.sessionId
        });
      }
    };
  }
  async health() {
    return await this.resolver.health();
  }
};
function createBackendClient(options) {
  return new BackendClient(options);
}

export {
  EventBus,
  CallbackRegistry,
  SequenceTracker,
  HTTPTransport,
  WebSocketTransport,
  BackendResolver,
  FrontendSession,
  BackendClient,
  createBackendClient
};

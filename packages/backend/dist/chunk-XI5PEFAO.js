// src/connectivity/IdempotencyManager.ts
var IdempotencyManager = class {
  inFlight = /* @__PURE__ */ new Map();
  completedCache = /* @__PURE__ */ new Map();
  ttlMs;
  constructor(ttlMs = 6e4) {
    this.ttlMs = ttlMs;
  }
  async executeIdempotent(idempotencyKey, operation) {
    const cached = this.completedCache.get(idempotencyKey);
    if (cached) {
      if (Date.now() - cached.timestamp < this.ttlMs) {
        if (cached.status === "completed") {
          return cached.result;
        }
        throw new Error(cached.error || "[IdempotencyManager] Previous execution failed.");
      } else {
        this.completedCache.delete(idempotencyKey);
      }
    }
    const existingFlight = this.inFlight.get(idempotencyKey);
    if (existingFlight) {
      return await existingFlight;
    }
    const executionPromise = (async () => {
      try {
        const result = await operation();
        this.completedCache.set(idempotencyKey, {
          status: "completed",
          result,
          timestamp: Date.now()
        });
        return result;
      } catch (err) {
        this.completedCache.set(idempotencyKey, {
          status: "failed",
          error: err?.message || String(err),
          timestamp: Date.now()
        });
        throw err;
      } finally {
        this.inFlight.delete(idempotencyKey);
      }
    })();
    this.inFlight.set(idempotencyKey, executionPromise);
    return await executionPromise;
  }
  has(idempotencyKey) {
    return this.inFlight.has(idempotencyKey) || this.completedCache.has(idempotencyKey);
  }
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.completedCache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.completedCache.delete(key);
      }
    }
  }
  clear() {
    this.inFlight.clear();
    this.completedCache.clear();
  }
};

// src/connectivity/JobScheduler.ts
var JobScheduler = class {
  jobs = /* @__PURE__ */ new Map();
  handlers = /* @__PURE__ */ new Map();
  sequenceCounters = /* @__PURE__ */ new Map();
  activeCount = 0;
  maxConcurrency;
  paused = false;
  constructor(maxConcurrency = 5) {
    this.maxConcurrency = maxConcurrency;
  }
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
    return this;
  }
  submit(input) {
    const id = input.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const streamKey = input.sequenceKey || "default";
    const seq = (this.sequenceCounters.get(streamKey) ?? 0) + 1;
    this.sequenceCounters.set(streamKey, seq);
    const job = {
      id,
      type: input.type,
      payload: input.payload,
      priority: input.priority || "NORMAL",
      sequence: seq,
      sequenceKey: streamKey,
      dependencies: input.dependencies || [],
      sessionId: input.sessionId,
      correlationId: input.correlationId,
      state: "PENDING",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.jobs.set(id, job);
    this.checkAndQueue(job);
    this.drainQueue();
    return job;
  }
  checkAndQueue(job) {
    if (job.state !== "PENDING") return false;
    const depsResolved = (job.dependencies || []).every((depId) => {
      const dep = this.jobs.get(depId);
      return dep && dep.state === "COMPLETED";
    });
    if (depsResolved) {
      job.state = "QUEUED";
      job.updatedAt = Date.now();
      return true;
    }
    return false;
  }
  priorityWeight(priority) {
    switch (priority) {
      case "CRITICAL":
        return 4;
      case "HIGH":
        return 3;
      case "NORMAL":
        return 2;
      case "LOW":
        return 1;
      default:
        return 2;
    }
  }
  async drainQueue() {
    if (this.paused || this.activeCount >= this.maxConcurrency) return;
    const queuedJobs = Array.from(this.jobs.values()).filter((j) => j.state === "QUEUED").sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority) || (a.sequence || 0) - (b.sequence || 0));
    for (const job of queuedJobs) {
      if (this.activeCount >= this.maxConcurrency) break;
      this.executeJob(job);
    }
  }
  async executeJob(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.state = "FAILED";
      job.error = `[JobScheduler] No registered handler for job type "${job.type}".`;
      job.updatedAt = Date.now();
      return;
    }
    this.activeCount++;
    job.state = "RUNNING";
    job.updatedAt = Date.now();
    const progressCallback = (progress) => {
      job.progress = Math.min(100, Math.max(0, progress));
      job.updatedAt = Date.now();
    };
    try {
      job.result = await handler(job, progressCallback);
      job.state = "COMPLETED";
      job.progress = 100;
    } catch (err) {
      job.state = "FAILED";
      job.error = err?.message || String(err);
    } finally {
      job.updatedAt = Date.now();
      this.activeCount--;
      for (const pendingJob of this.jobs.values()) {
        if (pendingJob.dependencies?.includes(job.id)) {
          this.checkAndQueue(pendingJob);
        }
      }
      this.drainQueue();
    }
  }
  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.state === "COMPLETED" || job.state === "FAILED") return false;
    job.state = "CANCELLED";
    job.updatedAt = Date.now();
    return true;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    this.drainQueue();
  }
  status(jobId) {
    return this.jobs.get(jobId);
  }
  getAllJobs() {
    return Array.from(this.jobs.values());
  }
  clear() {
    this.jobs.clear();
    this.sequenceCounters.clear();
    this.activeCount = 0;
  }
};

export {
  IdempotencyManager,
  JobScheduler
};

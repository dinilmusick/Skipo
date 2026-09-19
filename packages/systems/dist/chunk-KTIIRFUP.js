import {
  SKIPO_STATE,
  useSkipoState
} from "./chunk-4LKIXKH7.js";

// src/execution/BullMQAdapter.ts
import { Queue } from "bullmq";
var BullMQAdapter = class {
  queue;
  worker;
  inMemoryJobs = /* @__PURE__ */ new Map();
  inMemoryResults = /* @__PURE__ */ new Map();
  inMemoryListeners = /* @__PURE__ */ new Map();
  isInMemory = false;
  constructor(options) {
    if (options.useInMemory || !options.connection) {
      this.isInMemory = true;
    } else {
      try {
        this.queue = new Queue(options.queueName, { connection: options.connection });
      } catch {
        this.isInMemory = true;
      }
    }
  }
  async enqueue(job) {
    if (!this.isInMemory && this.queue) {
      const priorityVal = this.getPriorityNumber(job.priority);
      const bJob = await this.queue.add(job.command.type, job, {
        jobId: job.id,
        priority: priorityVal,
        attempts: job.retryPolicy?.maxAttempts || 3,
        backoff: job.retryPolicy ? { type: "exponential", delay: job.retryPolicy.backoffMs } : void 0
      });
      return bJob.id || job.id;
    }
    this.inMemoryJobs.set(job.id, { ...job, status: "QUEUED" });
    return job.id;
  }
  async getJobStatus(jobId) {
    if (!this.isInMemory && this.queue) {
      const bJob = await this.queue.getJob(jobId);
      if (!bJob) return void 0;
      const state = await bJob.getState();
      switch (state) {
        case "completed":
          return "COMPLETED";
        case "failed":
          return "FAILED";
        case "active":
          return "RUNNING";
        case "waiting":
        case "delayed":
          return "QUEUED";
        default:
          return "PENDING";
      }
    }
    return this.inMemoryJobs.get(jobId)?.status;
  }
  async getJobResult(jobId) {
    if (!this.isInMemory && this.queue) {
      const bJob = await this.queue.getJob(jobId);
      if (!bJob) return void 0;
      if (await bJob.isCompleted()) {
        return { correlationId: bJob.data.correlationId, status: "COMPLETED", data: bJob.returnvalue };
      }
      if (await bJob.isFailed()) {
        return { correlationId: bJob.data.correlationId, status: "FAILED", error: bJob.failedReason };
      }
      return void 0;
    }
    return this.inMemoryResults.get(jobId);
  }
  completeInMemoryJob(jobId, result) {
    const job = this.inMemoryJobs.get(jobId);
    if (job) {
      job.status = result.status === "COMPLETED" ? "COMPLETED" : "FAILED";
      job.updatedAt = Date.now();
      this.inMemoryResults.set(jobId, result);
      const listeners = this.inMemoryListeners.get(jobId) || [];
      listeners.forEach((fn) => fn(result));
      this.inMemoryListeners.delete(jobId);
    }
  }
  subscribeInMemoryJob(jobId, listener) {
    const existing = this.inMemoryResults.get(jobId);
    if (existing) {
      listener(existing);
      return () => {
      };
    }
    const current = this.inMemoryListeners.get(jobId) || [];
    current.push(listener);
    this.inMemoryListeners.set(jobId, current);
    return () => {
      const arr = this.inMemoryListeners.get(jobId) || [];
      this.inMemoryListeners.set(jobId, arr.filter((fn) => fn !== listener));
    };
  }
  getQueuedInMemoryJobs() {
    return Array.from(this.inMemoryJobs.values()).filter((j) => j.status === "QUEUED").sort((a, b) => this.getPriorityNumber(b.priority) - this.getPriorityNumber(a.priority));
  }
  async cancel(jobId) {
    if (!this.isInMemory && this.queue) {
      const bJob = await this.queue.getJob(jobId);
      if (bJob) {
        await bJob.remove();
        return true;
      }
      return false;
    }
    return this.inMemoryJobs.delete(jobId);
  }
  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    this.inMemoryJobs.clear();
    this.inMemoryResults.clear();
  }
  getPriorityNumber(priority) {
    switch (priority) {
      case "CRITICAL":
        return 1;
      case "HIGH":
        return 2;
      case "NORMAL":
        return 3;
      case "LOW":
        return 4;
      default:
        return 3;
    }
  }
};

// src/execution/CommandBus.ts
var CommandBus = class {
  constructor(adapter) {
    this.adapter = adapter;
  }
  adapter;
  createCommand(type, payload, metadata, lifecycle) {
    const timestamp = Date.now();
    const id = `cmd_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const correlationId = `corr_${timestamp}_${Math.random().toString(36).slice(2, 9)}`;
    return {
      id,
      type,
      payload,
      metadata,
      correlationId,
      lifecycle,
      createdAt: timestamp
    };
  }
  async enqueue(command, options = {}) {
    const now = Date.now();
    const idempotencyKey = options.idempotencyKey || `idem_${command.type}_${command.correlationId}`;
    const job = {
      id: `job_${now}_${Math.random().toString(36).slice(2, 7)}`,
      command,
      idempotencyKey,
      correlationId: options.correlationId || command.correlationId,
      retryPolicy: options.retryPolicy || { maxAttempts: 3, backoffMs: 1e3 },
      priority: options.priority || "NORMAL",
      dependencies: options.dependencies || [],
      status: "QUEUED",
      attempts: 0,
      createdAt: now,
      updatedAt: now
    };
    await this.adapter.enqueue(job);
    return job;
  }
};

// src/execution/SkipoExecution.ts
var SkipoExecutionEngine = class {
  frontendQueue;
  backendQueue;
  commandBus;
  constructor(options = {}) {
    this.frontendQueue = new BullMQAdapter({
      queueName: "FRONTEND_EXECUTION_QUEUE",
      connection: options.redisConnection
    });
    this.backendQueue = new BullMQAdapter({
      queueName: "BACKEND_EXECUTION_QUEUE",
      connection: options.redisConnection
    });
    this.commandBus = new CommandBus(this.frontendQueue);
  }
  createCommand(type, payload, metadata, lifecycle) {
    return this.commandBus.createCommand(type, payload, metadata, lifecycle);
  }
  async dispatch(type, payload, options = {}) {
    const cmd = this.createCommand(type, payload, void 0, options.correlationId);
    const job = await this.commandBus.enqueue(cmd, options);
    const stateId = `execution_${job.correlationId}`;
    SKIPO_STATE.create(
      "SKIPO_EXECUTION",
      { type: "APP" },
      { status: "QUEUED", correlationId: job.correlationId, progress: 0 },
      stateId
    );
    return job;
  }
  propagateResult(correlationId, result) {
    const stateId = `execution_${correlationId}`;
    if (SKIPO_STATE.get(stateId)) {
      SKIPO_STATE.update(stateId, () => ({
        status: result.status,
        correlationId,
        data: result.data,
        error: result.error,
        completedAt: Date.now()
      }));
    }
  }
  async close() {
    await this.frontendQueue.close();
    await this.backendQueue.close();
  }
};
var SKIPO_EXECUTION = new SkipoExecutionEngine();

// src/execution/hooks.ts
import { useState, useCallback } from "react";
function useCommand(type, defaultOptions = {}) {
  const [activeCorrId, setActiveCorrId] = useState(null);
  const [execState] = useSkipoState(
    activeCorrId ? `execution_${activeCorrId}` : `execution_idle_${type}`,
    { status: "IDLE" }
  );
  const dispatch = useCallback(
    async (payload, options) => {
      const mergedOptions = { ...defaultOptions, ...options };
      const job = await SKIPO_EXECUTION.dispatch(type, payload, mergedOptions);
      setActiveCorrId(job.correlationId);
      return job;
    },
    [type, defaultOptions]
  );
  return {
    dispatch,
    status: execState.status,
    isPending: execState.status === "QUEUED" || execState.status === "RUNNING",
    result: execState.data,
    error: execState.error,
    correlationId: execState.correlationId
  };
}

export {
  BullMQAdapter,
  CommandBus,
  SkipoExecutionEngine,
  SKIPO_EXECUTION,
  useCommand
};

import { Queue, Worker } from "bullmq";
import type { ExecutionJob, ExecutionJobStatus, JobPriority } from "./types";

type QueueConnection = NonNullable<ConstructorParameters<typeof Queue>[1]>["connection"];

export interface BullMQAdapterOptions {
  queueName: string;
  connection?: QueueConnection;
  useInMemory: boolean;
  maxConcurrency: number;
}
type Processor<TPayload> = (job: ExecutionJob<TPayload>) => Promise<unknown>;
interface MemoryJob {
  status: ExecutionJobStatus;
  result?: unknown;
  error?: string;
}
const priorityValue: Record<JobPriority, number> = {
  CRITICAL: 1, HIGH: 2, NORMAL: 5, LOW: 10,
};
function normalizeState(state: string): ExecutionJobStatus {
  if (state === "active") return "RUNNING";
  if (state === "completed") return "COMPLETED";
  if (state === "failed") return "FAILED";
  return "QUEUED";
}

/** Node-side queue adapter; Fetch/Worker entrypoints must not import this module. */
export class BullMQAdapter<TPayload = Record<string, unknown>> {
  private readonly queue?: Queue<ExecutionJob<TPayload>>;
  private readonly worker?: Worker<ExecutionJob<TPayload>>;
  private readonly memoryJobs = new Map<string, MemoryJob>();

  constructor(
    private readonly options: BullMQAdapterOptions,
    private readonly processor: Processor<TPayload>,
  ) {
    if (!options.useInMemory && options.connection) {
      this.queue = new Queue<ExecutionJob<TPayload>>(options.queueName, {
        connection: options.connection,
      });
      this.worker = new Worker<ExecutionJob<TPayload>>(
        options.queueName,
        async (job) => this.processor(job.data),
        { connection: options.connection, concurrency: Math.max(1, options.maxConcurrency) },
      );
      this.worker.on("error", (error) => console.error("[BullMQAdapter] Worker error:", error));
    }
  }

  async enqueue(job: ExecutionJob<TPayload>): Promise<string> {
    if (this.queue) {
      await this.queue.add(job.command.type, job, {
        jobId: job.id,
        priority: priorityValue[job.priority] ?? priorityValue.NORMAL,
        attempts: Math.max(1, job.retryPolicy.maxAttempts),
        backoff: { type: "fixed", delay: Math.max(0, job.retryPolicy.backoffMs) },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      return job.id;
    }
    this.memoryJobs.set(job.id, { status: "QUEUED" });
    queueMicrotask(() => void this.processInMemory(job));
    return job.id;
  }

  async getJobStatus(jobId: string): Promise<ExecutionJobStatus | undefined> {
    if (this.queue) {
      const job = await this.queue.getJob(jobId);
      return job ? normalizeState(await job.getState()) : undefined;
    }
    return this.memoryJobs.get(jobId)?.status;
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async processInMemory(job: ExecutionJob<TPayload>): Promise<void> {
    const record = this.memoryJobs.get(job.id);
    if (!record) return;
    record.status = "RUNNING";
    for (let attempt = 1; attempt <= Math.max(1, job.retryPolicy.maxAttempts); attempt += 1) {
      try {
        record.result = await this.processor(job);
        record.status = "COMPLETED";
        return;
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        if (attempt < Math.max(1, job.retryPolicy.maxAttempts)) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, job.retryPolicy.backoffMs)));
        }
      }
    }
    record.status = "FAILED";
  }
}

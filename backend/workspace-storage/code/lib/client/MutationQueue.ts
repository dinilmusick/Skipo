import { WorkspaceMutation, MutationResult } from '../mutations/mutation-types';

type FlushCallback = (mutations: WorkspaceMutation[]) => Promise<MutationResult>;

export class MutationQueue {
  private queue: Map<string, WorkspaceMutation> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private onFlush: FlushCallback;

  constructor(onFlush: FlushCallback, debounceMs = 1000) {
    this.onFlush = onFlush;
    this.debounceMs = debounceMs;
  }

  // Key to identify superseded mutations (e.g. repeated node moves)
  private getDedupeKey(mutation: WorkspaceMutation): string {
    return `${mutation.entity}:${mutation.entityId}:${mutation.operation}`;
  }

  public enqueue(mutation: WorkspaceMutation, immediate = false): void {
    const key = this.getDedupeKey(mutation);
    const existing = this.queue.get(key);

    if (existing) {
      // Merge patches for compatible operations
      this.queue.set(key, {
        ...mutation,
        patch: { ...existing.patch, ...mutation.patch },
      });
    } else {
      this.queue.set(key, mutation);
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      this.flush();
    } else {
      this.debounceTimer = setTimeout(() => {
        this.flush();
      }, this.debounceMs);
    }
  }

  public async flush(): Promise<MutationResult | null> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.queue.size === 0) return null;

    const mutationsToSend = Array.from(this.queue.values());
    this.queue.clear();

    try {
      return await this.onFlush(mutationsToSend);
    } catch (err) {
      // Re-queue on failure so mutations are not silently lost
      mutationsToSend.forEach((m) => {
        const key = this.getDedupeKey(m);
        if (!this.queue.has(key)) {
          this.queue.set(key, m);
        }
      });
      throw err;
    }
  }

  public get pendingCount(): number {
    return this.queue.size;
  }
}

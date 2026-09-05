export class WorkspaceCache {
  private cache = new Map<string, { data: any; revision: number; timestamp: number }>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public set<T>(key: string, data: T, revision = 0): void {
    this.cache.set(key, { data, revision, timestamp: Date.now() });
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const globalWorkspaceCache = new WorkspaceCache();

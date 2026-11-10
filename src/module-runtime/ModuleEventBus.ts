export class NamespacedModuleEventBus {
  readonly namespace: string;
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private closed = false;
  constructor(namespace: string) { this.namespace = namespace; }
  on<T>(event: string, listener: (payload: T) => void): () => void {
    if (this.closed || !event.trim()) throw new Error('Module event bus is closed or event is empty.');
    const bucket = this.listeners.get(event) ?? new Set();
    const wrapped = (payload: unknown) => listener(payload as T);
    bucket.add(wrapped); this.listeners.set(event, bucket);
    return () => { bucket.delete(wrapped); if (!bucket.size) this.listeners.delete(event); };
  }
  emit<T>(event: string, payload: T): void {
    if (this.closed) throw new Error('Module event bus is closed.');
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload);
  }
  clear(): void { this.closed = true; this.listeners.clear(); }
}

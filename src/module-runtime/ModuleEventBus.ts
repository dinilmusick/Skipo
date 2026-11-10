export class NamespacedModuleEventBus implements import('./ModuleRuntimeTypes.js').ModuleEventBus {
  readonly namespace: string;
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private closed = false;
  constructor(namespace: string) { this.namespace = namespace; }
  on<T>(event: string, listener: (payload: T) => void) {
    if (this.closed || !event.trim()) throw new Error('Module event bus is closed or event is empty.');
    const bucket = this.listeners.get(event) ?? new Set<(payload: unknown) => void>();
    const wrapped = (payload: unknown) => listener(payload as T); bucket.add(wrapped); this.listeners.set(event, bucket);
    return () => { bucket.delete(wrapped); if (!bucket.size) this.listeners.delete(event); };
  }
  emit<T>(event: string, payload: T) { if (this.closed) throw new Error('Module event bus is closed.'); for (const l of [...(this.listeners.get(event) ?? [])]) l(payload); }
  clear() { this.closed = true; this.listeners.clear(); }
}

import type { ModuleEventBus } from './ModuleRuntimeTypes.js';

export class NamespacedModuleEventBus implements ModuleEventBus {
  readonly namespace: string;
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private closed = false;

  constructor(namespace: string) { this.namespace = namespace; }

  on<T>(event: string, listener: (payload: T) => void): () => void {
    if (this.closed) throw new Error('Module event bus is closed.');
    const subscribers = this.listeners.get(event) ?? new Set<(payload: unknown) => void>();
    const wrapped = (payload: unknown) => listener(payload as T);
    subscribers.add(wrapped);
    this.listeners.set(event, subscribers);
    return () => { subscribers.delete(wrapped); };
  }

  emit<T>(event: string, payload: T): void {
    if (this.closed) throw new Error('Module event bus is closed.');
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload);
  }

  clear(): void { this.closed = true; this.listeners.clear(); }
}

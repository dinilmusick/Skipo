import type { ModuleEventBus } from '../contracts/ModuleContext.js';

type EventListener = (payload: unknown) => void;

export class NamespacedModuleEventBus implements ModuleEventBus {
  readonly namespace: string;
  private readonly listeners = new Map<string, Set<EventListener>>();
  private closed = false;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  emit<T = unknown>(event: string, payload: T): void {
    this.assertOpen();
    const listeners = this.listeners.get(this.qualify(event));
    if (!listeners) return;
    for (const listener of [...listeners]) listener(payload);
  }

  on<T = unknown>(event: string, listener: (payload: T) => void): () => void {
    this.assertOpen();
    if (typeof listener !== 'function') {
      throw new TypeError('Module event listener must be a function.');
    }
    const key = this.qualify(event);
    const bucket = this.listeners.get(key) ?? new Set<EventListener>();
    const wrapped: EventListener = (payload) => listener(payload as T);
    bucket.add(wrapped);
    this.listeners.set(key, bucket);
    return () => {
      bucket.delete(wrapped);
      if (bucket.size === 0) this.listeners.delete(key);
    };
  }

  clear(): void {
    this.closed = true;
    this.listeners.clear();
  }

  private qualify(event: string): string {
    if (typeof event !== 'string' || !event.trim()) {
      throw new Error('Module event name is required.');
    }
    return `${this.namespace}:${event}`;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Module event bus is closed.');
  }
}

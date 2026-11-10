export type ModuleLifecycleState =
  | 'discovered'
  | 'mounting'
  | 'mounted'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'unmounting'
  | 'unmounted'
  | 'failed';

export interface ModuleController {
  activate?(): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export interface ModuleLifecycleContext {
  readonly signal: AbortSignal;
  getState(): ModuleLifecycleState;
}

export interface ModuleInstance {
  readonly id: string;
  readonly context: import('./ModuleContext.js').ModuleContext;
  readonly state: ModuleLifecycleState;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  unmount(): Promise<void>;
}

export interface ModuleLifecycleSnapshot {
  readonly id: string;
  readonly state: ModuleLifecycleState;
  readonly mountedAt: number;
}

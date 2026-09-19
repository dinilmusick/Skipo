import { StoreApi } from 'zustand/vanilla';

/**
 * @file types.ts
 * @description Formal TypeScript types for SKIPO_STATE system.
 * Conforms strictly to SKIPO::STATE_EXECUTION_ARCHITECTURE and L9 (<=200L).
 */
type LifecycleScopeType = 'COMPONENT' | 'PAGE' | 'APP' | 'COMPONENT_DEPENDENCY' | 'STATE_DEPENDENCY';
interface LifecycleDescriptor {
    type: LifecycleScopeType;
    targetId?: string;
    retainCount?: number;
    createdAt?: number;
}
interface StateEntry<T = unknown> {
    id: string;
    owner: string;
    lifecycle: LifecycleDescriptor;
    value: T;
    dependencies: string[];
}
interface StateDeclaration<T = unknown> {
    id: string;
    initialValue: T;
    lifecycle: LifecycleDescriptor;
}
type StateUpdater<T> = (prev: T) => T;
interface LifecycleGraphNode {
    id: string;
    type: LifecycleScopeType;
    dependencies: Set<string>;
    dependents: Set<string>;
}
interface SkipoStateApi {
    create<T = unknown>(owner: string, lifecycle: LifecycleDescriptor, initialValue: T, id?: string): string;
    get<T = unknown>(id: string): T | undefined;
    set<T = unknown>(id: string, value: T): void;
    update<T = unknown>(id: string, updater: StateUpdater<T>): void;
    destroy(id: string): void;
    bind(stateId: string, lifecycleTarget: string): void;
    unbind(stateId: string, lifecycleTarget: string): void;
    lifecycle(stateId: string): LifecycleDescriptor | undefined;
    subscribe<T = unknown>(id: string, listener: (value: T | undefined) => void): () => void;
    getAllEntries(): Record<string, StateEntry<unknown>>;
    clear(): void;
}

/**
 * @file LifecycleGraph.ts
 * @description Directed Acyclic Graph (DAG) for state and component lifecycles.
 * Enforces cycle invalidation and recursive cascade destruction.
 */

declare class LifecycleCycleError extends Error {
    constructor(source: string, target: string);
}
declare class LifecycleGraph {
    private nodes;
    registerNode(id: string, type: LifecycleScopeType): LifecycleGraphNode;
    getNode(id: string): LifecycleGraphNode | undefined;
    hasCycle(start: string, target: string): boolean;
    addDependency(sourceId: string, targetId: string): void;
    removeDependency(sourceId: string, targetId: string): void;
    destroyCascade(rootId: string): string[];
    clear(): void;
}

/**
 * @file SkipoState.ts
 * @description Canonical SKIPO_STATE singleton backed by Zustand and LifecycleGraph.
 * Satisfies Invariants I1-I6 and L9 (<=200L).
 */

interface InternalStateStore {
    entries: Record<string, StateEntry<unknown>>;
    setEntry: (id: string, entry: StateEntry<unknown>) => void;
    removeEntry: (id: string) => void;
    clearAll: () => void;
}
declare class SkipoStateEngine implements SkipoStateApi {
    private graph;
    private store;
    constructor();
    create<T = unknown>(owner: string, lifecycle: LifecycleDescriptor, initialValue: T, explicitId?: string): string;
    get<T = unknown>(id: string): T | undefined;
    set<T = unknown>(id: string, value: T): void;
    update<T = unknown>(id: string, updater: StateUpdater<T>): void;
    destroy(id: string): void;
    bind(stateId: string, lifecycleTarget: string): void;
    unbind(stateId: string, lifecycleTarget: string): void;
    lifecycle(stateId: string): LifecycleDescriptor | undefined;
    subscribe<T = unknown>(id: string, listener: (value: T | undefined) => void): () => void;
    getAllEntries(): Record<string, StateEntry<unknown>>;
    getZustandStore(): StoreApi<InternalStateStore>;
    clear(): void;
}
declare const SKIPO_STATE: SkipoStateEngine;

/**
 * @file hooks.ts
 * @description React integration hooks for SKIPO_STATE.
 * Enforces component lifecycle binding, automatic unmount cleanup, and zero local useState.
 */

declare function useSkipoState<T>(id: string, initialValue?: T, lifecycle?: LifecycleDescriptor): [T, (valOrUpdater: T | StateUpdater<T>) => void];
declare function useLifecycleScope(scopeId: string, scopeType?: LifecycleScopeType): void;
declare function useSkipoBind(stateId: string, lifecycleTarget: string): void;

export { LifecycleCycleError, type LifecycleDescriptor, LifecycleGraph, type LifecycleGraphNode, type LifecycleScopeType, SKIPO_STATE, type SkipoStateApi, SkipoStateEngine, type StateDeclaration, type StateEntry, type StateUpdater, useLifecycleScope, useSkipoBind, useSkipoState };

// src/state/LifecycleGraph.ts
var LifecycleCycleError = class extends Error {
  constructor(source, target) {
    super(`[SKIPO_STATE] Cyclic lifecycle dependency detected: ${source} -> ${target}`);
    this.name = "LifecycleCycleError";
  }
};
var LifecycleGraph = class {
  nodes = /* @__PURE__ */ new Map();
  registerNode(id, type) {
    let node = this.nodes.get(id);
    if (!node) {
      node = {
        id,
        type,
        dependencies: /* @__PURE__ */ new Set(),
        dependents: /* @__PURE__ */ new Set()
      };
      this.nodes.set(id, node);
    }
    return node;
  }
  getNode(id) {
    return this.nodes.get(id);
  }
  hasCycle(start, target) {
    const visited = /* @__PURE__ */ new Set();
    const stack = [target];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === start) return true;
      if (!visited.has(current)) {
        visited.add(current);
        const node = this.nodes.get(current);
        if (node) {
          for (const dep of node.dependencies) {
            stack.push(dep);
          }
        }
      }
    }
    return false;
  }
  addDependency(sourceId, targetId) {
    if (sourceId === targetId) {
      throw new LifecycleCycleError(sourceId, targetId);
    }
    if (this.hasCycle(sourceId, targetId)) {
      throw new LifecycleCycleError(sourceId, targetId);
    }
    const sourceNode = this.registerNode(sourceId, "STATE_DEPENDENCY");
    const targetNode = this.registerNode(targetId, "COMPONENT");
    sourceNode.dependencies.add(targetId);
    targetNode.dependents.add(sourceId);
  }
  removeDependency(sourceId, targetId) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (sourceNode) sourceNode.dependencies.delete(targetId);
    if (targetNode) targetNode.dependents.delete(sourceId);
  }
  destroyCascade(rootId) {
    const destroyed = [];
    const visited = /* @__PURE__ */ new Set();
    const dfs = (currId) => {
      if (visited.has(currId)) return;
      visited.add(currId);
      const node = this.nodes.get(currId);
      if (node) {
        for (const depId of Array.from(node.dependents)) {
          dfs(depId);
        }
      }
      destroyed.push(currId);
    };
    dfs(rootId);
    for (const id of destroyed) {
      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          const depNode = this.nodes.get(depId);
          if (depNode) depNode.dependents.delete(id);
        }
      }
      this.nodes.delete(id);
    }
    return destroyed;
  }
  clear() {
    this.nodes.clear();
  }
};

// src/state/SkipoState.ts
import { createStore } from "zustand/vanilla";
var SkipoStateEngine = class {
  graph = new LifecycleGraph();
  store;
  constructor() {
    this.store = createStore((set) => ({
      entries: {},
      setEntry: (id, entry) => set((state) => ({ entries: { ...state.entries, [id]: entry } })),
      removeEntry: (id) => set((state) => {
        const next = { ...state.entries };
        delete next[id];
        return { entries: next };
      }),
      clearAll: () => set({ entries: {} })
    }));
  }
  create(owner, lifecycle, initialValue, explicitId) {
    if (!lifecycle || !lifecycle.type) {
      throw new Error(`[SKIPO_STATE] Explicit lifecycle MUST be declared for owner "${owner}".`);
    }
    const id = explicitId || `state_${owner}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.graph.registerNode(id, lifecycle.type);
    if (lifecycle.targetId) {
      this.graph.addDependency(id, lifecycle.targetId);
    }
    const entry = {
      id,
      owner,
      lifecycle: { ...lifecycle, createdAt: Date.now(), retainCount: 1 },
      value: initialValue,
      dependencies: lifecycle.targetId ? [lifecycle.targetId] : []
    };
    this.store.getState().setEntry(id, entry);
    return id;
  }
  get(id) {
    const entry = this.store.getState().entries[id];
    return entry ? entry.value : void 0;
  }
  set(id, value) {
    const current = this.store.getState().entries[id];
    if (!current) {
      throw new Error(`[SKIPO_STATE] State "${id}" not found. Must call create() first.`);
    }
    this.store.getState().setEntry(id, { ...current, value });
  }
  update(id, updater) {
    const current = this.store.getState().entries[id];
    if (!current) {
      throw new Error(`[SKIPO_STATE] State "${id}" not found. Must call create() first.`);
    }
    const nextValue = updater(current.value);
    this.store.getState().setEntry(id, { ...current, value: nextValue });
  }
  destroy(id) {
    const toDestroy = this.graph.destroyCascade(id);
    for (const targetId of toDestroy) {
      this.store.getState().removeEntry(targetId);
    }
  }
  bind(stateId, lifecycleTarget) {
    const current = this.store.getState().entries[stateId];
    if (!current) {
      throw new Error(`[SKIPO_STATE] State "${stateId}" not found for binding.`);
    }
    this.graph.addDependency(stateId, lifecycleTarget);
    if (!current.dependencies.includes(lifecycleTarget)) {
      this.store.getState().setEntry(stateId, {
        ...current,
        dependencies: [...current.dependencies, lifecycleTarget]
      });
    }
  }
  unbind(stateId, lifecycleTarget) {
    const current = this.store.getState().entries[stateId];
    if (current) {
      this.graph.removeDependency(stateId, lifecycleTarget);
      this.store.getState().setEntry(stateId, {
        ...current,
        dependencies: current.dependencies.filter((d) => d !== lifecycleTarget)
      });
    }
  }
  lifecycle(stateId) {
    return this.store.getState().entries[stateId]?.lifecycle;
  }
  subscribe(id, listener) {
    let prev = this.get(id);
    return this.store.subscribe((state) => {
      const next = state.entries[id]?.value;
      if (next !== prev) {
        prev = next;
        listener(next);
      }
    });
  }
  getAllEntries() {
    return this.store.getState().entries;
  }
  getZustandStore() {
    return this.store;
  }
  clear() {
    this.graph.clear();
    this.store.getState().clearAll();
  }
};
var SKIPO_STATE = new SkipoStateEngine();

// src/state/hooks.ts
import { useEffect, useSyncExternalStore, useRef, useCallback } from "react";
function useSkipoState(id, initialValue, lifecycle = { type: "APP" }) {
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    const existing = SKIPO_STATE.get(id);
    if (existing === void 0 && initialValue !== void 0) {
      SKIPO_STATE.create(id, lifecycle, initialValue, id);
    }
    initializedRef.current = true;
  }
  const subscribe = useCallback(
    (onStoreChange) => {
      return SKIPO_STATE.subscribe(id, () => onStoreChange());
    },
    [id]
  );
  const getSnapshot = useCallback(() => {
    return SKIPO_STATE.get(id);
  }, [id]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    return () => {
      if (lifecycle.type === "COMPONENT") {
        SKIPO_STATE.destroy(id);
      }
    };
  }, [id, lifecycle.type]);
  const setValue = useCallback(
    (valOrUpdater) => {
      if (typeof valOrUpdater === "function") {
        SKIPO_STATE.update(id, valOrUpdater);
      } else {
        SKIPO_STATE.set(id, valOrUpdater);
      }
    },
    [id]
  );
  return [value, setValue];
}
function useLifecycleScope(scopeId, scopeType = "COMPONENT") {
  useEffect(() => {
    return () => {
      SKIPO_STATE.destroy(scopeId);
    };
  }, [scopeId, scopeType]);
}
function useSkipoBind(stateId, lifecycleTarget) {
  useEffect(() => {
    SKIPO_STATE.bind(stateId, lifecycleTarget);
    return () => {
      SKIPO_STATE.unbind(stateId, lifecycleTarget);
    };
  }, [stateId, lifecycleTarget]);
}

export {
  LifecycleCycleError,
  LifecycleGraph,
  SkipoStateEngine,
  SKIPO_STATE,
  useSkipoState,
  useLifecycleScope,
  useSkipoBind
};

---
name: entity-functionality-architecture
description: Directives for Entity-Functionality folder architecture, main functionality files, helper folders, events, state isolation, and System Entity entry point.
---

# ENTITY & FUNCTIONALITY ARCHITECTURE GUIDELINES

## 1. GROSS ARCHITECTURAL HIERARCHY (FLAT MULTI-ENTITY STANDARD)
All projects authored or maintained by the AI agent MUST strictly conform to this flat layout:

```
PROJECT_ROOT/
├── krnl.json                         → Multi-entity & variant build configuration
│
├── src/                              → Flat Application Root
│   ├── <EntityA>.ts                  → Flat Entity A directly at src root
│   ├── <EntityB>.ts                  → Flat Entity B directly at src root (peer at same level)
│   │
│   ├── functionalities/              → ONE shared directory for all quad-units
│   │   └── <FeatureName>/            → e.g., ProcessPayment, CreateUser, SyncOrder
│   │       ├── <FeatureName>Atom.ts  → Metadata descriptor & capability spec
│   │       ├── main_function/
│   │       │   ├── logic.ts          → Core orchestrator (receives input, { state, entity })
│   │       │   └── lifecycle.ts      → onMount / onTeardown lifecycle hooks
│   │       ├── state_data/
│   │       │   └── state.ts          → State schema & atomic accessors (/** @role component */)
│   │       ├── helper_functions/     → Pure functions (Layer 0A, /** @role component */)
│   │       ├── events/               → Domain event emitters (/** @role component */)
│   │       └── manifest.json         → Declared dependencies, tools, resources
│   │
│   ├── libraries/                    → Universal Shared Concept Libraries (ONLY for functionalities)
│   │   ├── MathConcepts.ts           → Pure math, calculations, vector algorithms
│   │   ├── DataConcepts.ts           → Canonical types, indexing, grouping, diffing, lenses
│   │   └── ValidationConcepts.ts     → Schema validation & assertion contracts
│   │
│   ├── protocol_adapters/            → Ingress Network Adapters (HTTP, WSS, MCP)
│   │   ├── HttpsAdapter.ts           → REST routes (/call/{fid}, /api/...)
│   │   └── WssAdapter.ts             → WebSocket RPC & live event mirroring
│   │
│   └── subapps/                      → Zero-server self-contained engines
│
└── frontends/                        → UI Packages (Vite/React apps or Glass-Brutalist UIs)
```

---

## 2. FUNCTIONALITY SPECIFICATION (QUAD-UNIT PACKAGING)
- **Shared Folder Location**: Resides in `src/functionalities/<FeatureName>/`. One folder per feature across the whole system.
- **Internal Quad-Unit Structure**:
  - `main_function/logic.ts`: Primary orchestrator receiving `(input, { state, entity })`.
  - `main_function/lifecycle.ts`: Optional `onMount` and `onTeardown` handlers.
  - `state_data/state.ts`: Initial observable state schema and atomic getters/setters.
  - `helper_functions/`: Subdirectory isolating modular, pure Layer 0A helper functions.
  - `events/`: Subdirectory isolating domain event definitions and emitters.
  - `manifest.json`: Declared npm packages and system tools required by this functionality.
- **Calling Libraries**: Functionalities and their helpers ARE permitted to call shared libraries from `src/libraries/`.
- **Stateless Preference**:
  $$\text{Preference}(\text{Functionality}) = \text{Stateless} \succ \text{Stateful}$$
  Use `state_data/state.ts` only when persistent runtime state is mandatory.

### 2.1 EVENT-DRIVEN COMMUNICATION OVER ON-TICK / POLLING INVARIANT
```
∀ communication, synchronization, or change detection:
  pattern ≡ EVENT_DRIVEN  (via events/*.ts, entity.emitEvent, entity.on, or reactive streams)
  polling ≡ STRICTLY_FORBIDDEN (default)
```
- **Prohibit onTick / Polling Loops**: AI agents MUST NOT implement `onTick()`, `tick()`, `setInterval()`, or recursive `setTimeout()` loops for state synchronization, checking file changes, or waiting on task completions.
- **Strict Event-Driven Pattern**: State mutations emit `state:changed`, domain events trigger down-stream actions via `entity.emitEvent("domain:action", payload)` and subscribers receive updates via `entity.on("domain:action", handler)`.

---

## 3. ENTITY SPECIFICATION (FLAT PEER ORCHESTRATOR)
- **Flat File Placement**: Entities reside directly in `src/` at the same level (e.g., `src/UserSystem.ts`, `src/BillingSystem.ts`).
- **Zero Nesting Invariant**: Nested component entities (`entities/<ChildEntity>/...`) are **strictly prohibited**.
- **Orchestration**: Entities orchestrate:
  1. Functionalities from `src/functionalities/` via `.thenFunctionality(fid)` or `.then(fid)`.
  2. Orchestrations and capabilities from other entities via `.thenEntityOrchestration(entityName, flowId)`.
- **Strict Library Prohibition**: Entities **must never** import or call libraries directly (`src/libraries/*`). Calls to `.thenFunction()` inside entities are prohibited; all domain operations must be encapsulated in functionalities.
- **Class Pattern**: Subclasses `Entity<TState, TEvents>` annotated with `/** @role skeleton */`.

---

## 4. APP VARIANTS & COMBINED BUILDS
- **Independent App Variants**: Each entity can be independently built and started as an app variant:
  `krnl dev --entity <EntityName>` or `krnl build --entity <EntityName>`.
- **Combined Builds**: Multiple entities can be combined into a single unified build:
  `krnl dev --all` or `krnl build --all`. In combined mode, all entities register into `KrnlEntityRegistry` and seamlessly cross-orchestrate each other in-process.

---

## 5. STRUCTURAL CHANGE ENFORCEMENT
```python
def on_structural_code_change(intent):
    """
    MANDATORY PRE-CHECK BEFORE CREATING OR REFACTORING CODEBASE STRUCTURE:
    1. Verify entity file is directly in src/ (src/<EntityName>.ts).
    2. Verify no nested entities/ folders exist anywhere.
    3. Verify functionality is in src/functionalities/<FeatureName>/.
    4. Verify libraries are in src/libraries/ and NOT imported by entities.
    5. Verify cross-entity calls use thenEntityOrchestration.
    """
    assert is_directly_in_src(intent.entity_path)
    assert not has_nested_entities_dir(intent.workspace)
    assert is_in_shared_functionalities(intent.functionality_path)
    assert not entity_imports_libraries(intent.entity_file)
```

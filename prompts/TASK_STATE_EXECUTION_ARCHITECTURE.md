# TASK: STATE_EXECUTION_ARCHITECTURE_ENFORCEMENT

$$\text{Valid}(\mathcal{P}) \iff \text{SkipoState}(\mathcal{P}) \wedge \text{ZustandGlobal}(\mathcal{P}) \wedge \text{AcyclicLifecycle}(\mathcal{P}) \wedge \text{BullMQExecution}(\mathcal{P}) \wedge \text{WorkerFacadeBoundary}(\mathcal{P}) \wedge (\text{ExitCode}(\text{Validator}) = 0)$$

> **EXCLUSIVE SCOPE**: This prompt owns **frontend state management (`SKIPO_STATE` / Zustand), explicit lifecycle graph governance, execution transport (`SKIPO_COMMAND` / BullMQ), Worker-only Backend Facade boundary, and deterministic Operation Components**.
>
> **Validator**:
> ```bash
> python3 assistant.py validate . --aspect aspect_13
> ```
>
> **INVIOLABLE MANDATE: ZERO-TRACE LEGACY STATE & EXECUTION PURGE ($\mathbf{L_{21}}$)**:
> Completely purge any competing legacy state managers (e.g. Redux, MobX, scattered unmanaged React Contexts, ad-hoc event emitters) and competing execution pipelines (e.g. in-process unthrottled queues, ad-hoc cron loops). Leave zero trace behind. The app must exclusively use `SKIPO_STATE` (Zustand) and `SKIPO_COMMAND` (BullMQ) execution boundaries.

---

## 0. MANDATORY FIRST STEP — INGEST & AUDIT

Run the Aspect 13 validator to identify all state and execution boundary violations:

```bash
python3 assistant.py validate . --aspect aspect_13
```

Read the formal specification:
```
architecture/state-execution-spec/SKILL.md
```

---

## 1. STATE SYSTEM: ZUSTAND & EXPLICIT LIFECYCLES (Invariants I1–I6)

$$\forall \text{Component } C: C.\text{state} \subseteq \text{SKIPO\_STATE}, \quad C \notin \{\text{ReactLocalState}, \text{PropDrillingState}\}$$

### 1.1 Banned Patterns
```tsx
// ❌ BANNED — React local state for application domain data
const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);

// ❌ BANNED — Prop drilling state across component trees
<ChildComponent items={items} setItems={setItems} />
```

### 1.2 Mandatory Replacement Pattern
```tsx
// ✅ CORRECT — SKIPO_STATE backed by Zustand with explicit lifecycle
import { useSkipoState } from '@skipo/systems/state';

// Component-scoped: auto-destroyed when component unmounts
const [workspaces, setWorkspaces] = useSkipoState<Workspace[]>(
  'user_workspaces',
  [],
  { type: 'COMPONENT' }
);

// App-scoped: persistent across component lifecycles
const [userProfile, setUserProfile] = useSkipoState<UserProfile | null>(
  'current_user_profile',
  null,
  { type: 'APP' }
);

// Dependency-scoped: retained while parent target exists
const [selection, setSelection] = useSkipoState<string | null>(
  'active_selection',
  null,
  { type: 'COMPONENT_DEPENDENCY', targetId: 'WorkspaceTilesMenu' }
);
```

### 1.3 Lifecycle Graph Invariants
1. Every state MUST declare an explicit lifecycle (`COMPONENT`, `PAGE`, `APP`, `COMPONENT_DEPENDENCY`, `STATE_DEPENDENCY`).
2. Lifecycle graph MUST be an acyclic DAG ($S_1 \to S_2 \to S_1$ is strictly forbidden).
3. Cascade destruction: Destroying a scope or state automatically destroys all dependent states and purges them from Zustand.

---

## 2. EXECUTION SYSTEM: BULLMQ COMMAND BOUNDARY (Invariants I7–I10)

$$\text{EXECUTION\_PIPELINE} := \text{FRONTEND\_COMPONENT} \to \text{SKIPO\_COMMAND} \to \text{BullMQ} \to \text{JOB} \to \text{WORKER} \to \text{BACKEND\_FACADE} \to \text{SERVICE} \to \text{OPERATION\_COMPONENT}$$

### 2.1 Banned Execution Patterns
```tsx
// ❌ BANNED — Direct network fetch in component or hook
const handleSave = async () => {
  const res = await fetch('/api/workspace', { method: 'POST', body: JSON.stringify(data) });
};

// ❌ BANNED — Direct component call to backend facade or service
import { AppBackend } from '@/backend/AppBackend';
const result = await AppBackend.services.workspace.create(payload);

// ❌ BANNED — Direct database/storage SDK invocation in frontend
import { db } from '@/database';
await db.insert(workspaces).values(data);
```

### 2.2 Mandatory Replacement Pattern
```tsx
// ✅ CORRECT — Dispatched via useCommand -> BullMQ execution queue
import { useCommand } from '@skipo/systems/execution';

export function WorkspaceCreator() {
  const { dispatch, isPending, result, error } = useCommand('workspace.create', {
    retryPolicy: { maxAttempts: 3, backoffMs: 1000 }
  });

  const handleCreate = async () => {
    await dispatch({ name: 'Project Alpha', engine: 'local_fs' });
  };

  return (
    <Button onClick={handleCreate} disabled={isPending}>
      {isPending ? 'Creating...' : 'Create Workspace'}
    </Button>
  );
}
```

---

## 3. BACKEND BOUNDARY: WORKER-ONLY FACADE (Invariants I11–I14)

$$\text{BACKEND\_FACADE} := \text{SINGLE\_PUBLIC\_EXECUTION\_INTERFACE}, \quad \text{FACADE\_ACCESS} := \text{WORKER\_ONLY}$$

### 3.1 Backend Facade Invariant
The backend facade is accessible **ONLY** by BullMQ Workers. Any call lacking `isWorkerContext: true` is immediately rejected.

```typescript
// src/backend/AppBackend.ts
import { ExecutableBackendFacade, WorkerExecutionBoundary } from '@skipo/backend';

export const appBackendFacade = new ExecutableBackendFacade('AppBackend');
export const appWorker = new WorkerExecutionBoundary('app_worker_1', appBackendFacade);

export const AppBackend = {
  services: {},
  orchestrations: {},
  worker: appWorker,
  WorkerExecutionBoundary: appWorker,
};
```

### 3.2 Service & Operation Components
- Services are domain orchestration units that route commands to operation components.
- Operation components are the smallest deterministic domain operations: `input -> deterministic operation -> output`.
- Idempotency: Every observable job MUST provide an `idempotencyKey` ensuring duplicate execution yields a single logical effect.

```typescript
// src/backend/services/workspace/operations/createWorkspace.ts
import { createOperationComponent } from '@skipo/backend';

export const createWorkspaceOp = createOperationComponent(
  'createWorkspace',
  async (input: { name: string }) => {
    // Pure deterministic domain logic
    return { id: `ws_${Date.now()}`, name: input.name, createdAt: Date.now() };
  }
);
```

---

## 4. RESULT FLOW & STATE SYNCHRONIZATION

$$\text{operation} \to \text{service} \to \text{facade} \to \text{worker} \to \text{job\_result} \to \text{frontend\_state\_update} \to \text{Zustand}$$

1. The Worker receives the result from the operation component via the Backend Facade.
2. The Worker normalizes the result: `{ correlationId, status: 'COMPLETED', data }`.
3. `SKIPO_EXECUTION.propagateResult` updates `SKIPO_STATE` (Zustand).
4. Any component subscribed to `useCommand` or `useSkipoState` reacts instantly without polling or manual re-fetching.

---

## 5. SPAM REFACTORING RECIPE (1–2 PASSES TO EXIT 0)

1. **Scan Violations**:
   ```bash
   python3 assistant.py validate . --aspect aspect_13
   ```
2. **Replace Local State**:
   - Replace `useState<T[]>` or domain objects in `src/frontend/` with `useSkipoState<T>(id, initialValue, lifecycle)`.
3. **Replace Direct Calls**:
   - Replace direct `fetch()` and `Backend.services.*` with `useCommand(type)`.
4. **Harden Backend Facade**:
   - Wrap backend facade with `WorkerExecutionBoundary`.
5. **Verify Gate (Mandatory Exit 0)**:
   ```bash
   python3 assistant.py validate . --aspect aspect_13 && pnpm test
   ```

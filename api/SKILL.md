---
name: api-guidelines
description: Directives for full headless REST API parity, external endpoint triggering, real-time observable UI state synchronization, and automated test suite verification.
---

# API DEVELOPMENT, HEADLESS PARITY & REAL-TIME UI MIRRORING

## 1. INVIOLABLE API LAWS

### Law 1: Absolute Feature-to-API Parity
$$\forall \text{feature} \in \text{AppFeatures}, \quad \exists \text{endpoint}(\text{feature}) \quad \text{s.t.} \quad \text{signature}(\text{endpoint}) \equiv \text{signature}(\text{feature})$$
Every application action executable by a human via UI (creating items, modifying stacks, moving nodes, toggling themes, switching workspaces, saving files) MUST be 100% executable programmatically via headless REST API endpoints.

### Law 2: Zero Phantom Executions & Real-Time UI Mirroring
$$\text{onExternalApiCall}(\text{req}, \text{action}) \implies \text{publishRealtimeEvent}(\text{action}) \land \text{mutateLiveUIState}(\text{screen})$$
Silent / phantom API execution is strictly forbidden. Any mutation triggered externally by an agent, CLI, or test script MUST:
1. Publish an event to the real-time event bus (`lib/realtime-events.ts`).
2. Stream to connected browsers via SSE or fast-polling (`/api/events`).
3. Trigger a visible toast notification and HUD telemetry log in the client.
4. Mutate in-memory React state in place without requiring a page reload.

---

## 2. THE 5-STEP AGENT SCAFFOLDING BLUEPRINT

When scaffolding or enhancing any Skipo-compliant application, the AI agent MUST execute these 5 steps:

```
[ Step 1: Event Bus ] ──> [ Step 2: /api/events ] ──> [ Step 3: useRealtimeApiSync ]
                                                              │
[ Step 5: test-api-suite ] <── [ Step 4: Decorate Routes with publishRealtimeEvent ]
```

### Step 1: Event Bus (`lib/realtime-events.ts`)
Maintain an in-memory rolling buffer (150-200 events) and event listener set. Preserve instance across development HMR via `globalThis`:
```typescript
import { publishRealtimeEvent, subscribeRealtimeEvents, getRecentEvents } from '@/lib/realtime-events';

publishRealtimeEvent({
  action: 'DOCUMENT_CREATED',
  method: 'POST',
  endpoint: '/api/documents',
  workspaceId: 'ws-123',
  details: 'Created document "Architecture.md"',
  payload: newDocument,
});
```

### Step 2: SSE / Polling Stream Route (`app/api/events/route.ts`)
Expose `GET /api/events`:
- If `?stream=true` or `Accept: text/event-stream`: Open SSE stream with a 15-second heartbeat (`: heartbeat <ts>\n\n`) to prevent Vercel/proxy timeouts.
- If polling (`GET /api/events?since=<ts>`): Return `{ success: true, events: [...] }` containing events newer than `since`.
- Always filter events by `x-workspace-id` or `?workspaceId=` query parameter.

### Step 3: Client Sync Hook (`hooks/useRealtimeApiSync.ts`)
Connect the client UI to `/api/events`. Wire it into the root application component (`app/page.tsx` or `AppShell.tsx`):
```tsx
useRealtimeApiSync({
  enabled: true,
  workspaceId: activeWorkspaceId,
  onDocumentEvent: (event) => {
    if (event.action === 'DOCUMENT_CREATED') setDocuments(prev => [event.payload, ...prev]);
    if (event.action === 'DOCUMENT_UPDATED') setDocuments(prev => prev.map(d => d.id === event.payload.id ? event.payload : d));
    if (event.action === 'DOCUMENT_DELETED') setDocuments(prev => prev.filter(d => d.id !== event.payload.id));
  },
  onCategoryEvent: (event) => { /* update stacks state */ },
  onGraphEvent: (event) => { /* update nodes/edges state */ },
  onBiomeEvent: (event) => { /* update theme state */ },
  onApiAction: (msg) => showFloatingToast(msg),
});
```

### Step 4: Decorate Route Handlers
Every mutation route handler (`POST`, `PUT`, `DELETE`) must invoke `publishRealtimeEvent(...)` upon successful execution before returning the response.

### Step 5: Automated Verification Suite (`scripts/test-api-suite.ts`)
Add `"test:api": "npx tsx scripts/test-api-suite.ts"` to `package.json`. The suite must run against both `http://localhost:3000` and live deployments (e.g. `https://<app>.vercel.app`).

---

## 3. CANONICAL API REGISTRY & CONTRACTS

| Domain | Route | Method | Headers / Params | Response | Broadcast Event |
|---|---|---|---|---|---|
| **Real-Time Stream** | `/api/events` | `GET` | `?stream=true` or `?since=<ts>` | SSE Stream / `{ success, events }` | `SUBSCRIBE_EVENTS` |
| **Auth Register** | `/api/auth/register` | `POST` | `{ email, password, name }` | `{ success, token, user }` (201) | `USER_REGISTERED` |
| **Auth Login** | `/api/auth/login` | `POST` | `{ email, password }` | `{ success, token, user }` | `USER_LOGGED_IN` |
| **Profile Me** | `/api/auth/me` | `GET` | `Authorization: Bearer <token>` | `{ success, user }` | N/A |
| **Workspaces List** | `/api/auth/workspaces` | `GET` | `Authorization: Bearer <token>` | `{ success, workspaces, activeWorkspaceId }` | N/A |
| **Workspace Create** | `/api/auth/workspaces` | `POST` | `{ name, engine, description }` | `{ success, workspace, activeWorkspaceId }` | `WORKSPACE_UPDATED` |
| **Workspace Switch** | `/api/auth/workspaces` | `PUT` | `{ workspaceId }` | `{ success, activeWorkspaceId }` | `WORKSPACE_SWITCHED` |
| **Stacks List** | `/api/categories` | `GET` | `x-workspace-id: <id>` | `{ success, categories: DocCategory[] }` | N/A |
| **Stack Create** | `/api/categories` | `POST` | `{ title, glyph, color }` | `{ success, category }` (201) | `CATEGORY_CREATED` |
| **Stack Update** | `/api/categories` | `PUT` | `{ id, title, color }` | `{ success, category }` | `CATEGORY_UPDATED` |
| **Stack Delete** | `/api/categories` | `DELETE` | `?id=<catId>` or `{ id }` | `{ success, purgedId }` | `CATEGORY_DELETED` |
| **Documents List** | `/api/documents` | `GET` | `?categoryId=<id>` or `?id=<docId>` | `{ success, documents }` or `{ document }` | N/A |
| **Document Create** | `/api/documents` | `POST` | `{ title, content, categoryId }` | `{ success, document }` (201) | `DOCUMENT_CREATED` |
| **Document Update** | `/api/documents` | `PUT` | `{ id, content, ... }` | `{ success, document }` | `DOCUMENT_UPDATED` |
| **Document Delete** | `/api/documents` | `DELETE` | `?id=<docId>` or `{ id }` | `{ success, purgedId }` | `DOCUMENT_DELETED` |
| **NLP Analysis** | `/api/analyze-doc` | `POST` | `{ title, content, fileType }` | `{ engine, summary, tags, categorySuggestion }` | `ANALYZE_DOC` |
| **NLP Chat** | `/api/chat-doc` | `POST` | `{ documentTitle, documentContent, messages }` | `{ text, engine }` | `CHAT_DOC` |
| **Graph Topology** | `/api/graph` | `GET` | `x-workspace-id: <id>` | `{ success, nodes, edges, groups }` | N/A |
| **Graph Mutation** | `/api/graph` | `POST` | `{ action, payload }` | `{ success, graph }` | `GRAPH_UPDATED` |
| **Biome / Theme** | `/api/biome` | `GET`, `POST` | `{ theme, biome }` | `{ success, theme, biome }` | `BIOME_CHANGED` |
| **Workspace Vault** | `/api/workspace` | `GET`, `POST` | `?file=<path>` or `{ relativePath, content }` | `{ success, tree / content }` | `WRITE_VAULT_FILE` |
| **Telemetry Ping** | `/api/telemetry` | `GET` | N/A | `{ status, runtime, uptimeSeconds }` | N/A |
| **UI State Introspection** | `/api/debug/ui-state` | `GET`, `POST` | `?section=nodegraph \| menus \| vault \| settings \| localstorage \| sync` | `{ success, data: <section_state> }` | N/A |
| **3-Tier Sync Audit** | `/api/debug/sync-audit` | `GET` | N/A | `{ success, isFullySynced, syncScorePercent, auditDetails }` | N/A |

---

## 4. MULTI-TENANCY & WORKSPACE ISOLATION

1. **Authentication Token**: Send `Authorization: Bearer <token>` with every authenticated request.
2. **Workspace Routing**: Send `x-workspace-id: <workspaceId>` header with every resource request.
   - The backend resolves the workspace via `resolveRequestContextVault(req)`.
   - Never hardcode filesystem paths or single-tenant global state.
3. **Zero-Crash Local DB Fallback**:
   - If no cloud database connection string (`DATABASE_URL`, `SUPABASE_URL`) is configured in the environment, the control plane MUST gracefully persist users to local file storage and return `{ success: true, targetsUpdated: ['local_storage'] }` rather than crashing with an unhandled exception.

---

## 5. FRONTEND-BACKEND STATE INTROSPECTION & SYNC AUDIT PARADIGM

Every application built using Skipo must enforce 100% synchronization between frontend UI states, browser local storage, and the backend persistent store:
1. **Programmatic State Introspection**: The client exposes `window.AppDebug` (or `window.DocuStackDebug`) with granular getters (`getNodeGraph()`, `getWorkspacesMenu()`, `getVaultBrowserStructure()`, `getSettingsAndPreferences()`, `getLocalStorageState()`).
2. **Real-Time LocalStorage Mirroring**: Actions performed on UI assets (e.g. node graph additions/edits/moves) are immediately mirrored to browser `localStorage` to guard against session loss and enable offline discrepancy detection.
3. **Dual API Access**: The UI state is continuously debounced and relayed to `POST /api/debug/ui-state`. External automated test harnesses and CLI tools can inspect any UI facet via `GET /api/debug/ui-state?section=<section>` or run deep 3-way synchronization audits via `GET /api/debug/sync-audit`.
4. **Visual Debug Inspector**: The UI mounts a brutalist HUD inspector modal (`Cmd+Shift+D` shortcut) that provides live check status, diff tables, and one-click JSON exports.

---

## 6. REUSABLE ASSETS DIRECTORY

The following drop-in assets are bundled in the Skipo framework for direct use in new projects:
- **Hooks**:
  - `hooks/useRealtimeApiSync.ts` (Event bus stream listener)
  - `hooks/useUiStateDebugger.ts` (Reactive UI state bridge & LocalStorage mirror)
- **State Schemas & Sync Engine**:
  - `lib/debug-ui-state.ts` (Full state interfaces, localStorage extractor, and sync audit calculator)
  - `lib/realtime-events.ts` (In-memory pub/sub event bus)
- **Route Templates**:
  - `api/events/route.ts` (SSE & polling event stream)
  - `api/debug/ui-state/route.ts` (UI state introspection & relay route)
  - `api/debug/sync-audit/route.ts` (3-tier synchronization audit route)
- **UI Components**:
  - `components/debug/DebugStateModal.tsx` (Interactive HUD state debugger modal)
- **Headless Test Suites**:
  - `scripts/test-api-suite.ts` (Full 25-step headless API verification suite)
  - `scripts/test-debug-ui-state.ts` (Dedicated 8-step UI state & sync audit verification suite)
  - `scripts/verify-control-plane-standards.sh` (31-check architectural standards compliance audit)

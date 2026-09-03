---
name: api-guidelines
description: Directives for API surface parity, external endpoint triggering, observable UI state synchronization, and endpoint contracts.
---

# API DEVELOPMENT & EXPOSURE GUIDELINES

## 1. FEATURE-TO-API PARITY
```
∀ feature ∈ Application_Features:
  ∃ endpoint(feature) s.t. 
    signature(endpoint) ≡ signature(feature) ∧ 
    accessible(endpoint, scope = EXTERNAL_CALLABLE)
```
- **Rule**: Every single application feature MUST expose a matching REST API endpoint with identical functionality, callable by external services, subagents, or CLI automation just like a human user would interact via UI.

---

## 2. OBSERVABLE STATE & LIVE UI MONITORING
```
function onExternalEndpointInvocation(req, endpoint):
    executeBackendLogic(endpoint, req.payload)
    emitSyncEvent(event_type = "EXTERNAL_API_MUTATION", payload = req.payload)
    triggerVisibleUIStateChange(screen_target = endpoint.domain)
// Silent / phantom API execution is strictly forbidden. External calls MUST be visible in UI monitoring state.
```
- **Zero Phantom Operations**: Any mutation or execution triggered via an API endpoint must broadcast a structured telemetry event (`emitTelemetry` via `lib/api-client.ts`) and reflect immediately in the live UI `ActivityMonitor` and status toasts.
- External services interacting with the app can see their commands reflected live on the UI screens.

---

## 3. CANONICAL API REGISTRY & CONTRACTS

| Domain | Route | Method | Payload / Params | Response | Telemetry Event |
|---|---|---|---|---|---|
| **Workspace Tree** | `/api/workspace` | `GET` | `?source=primary\|local` | `{ success, tree, stats, vaultPath, isCloudPrimary, storageProvider }` | `FETCH_WORKSPACE_TREE` |
| **Workspace File Read** | `/api/workspace` | `GET` | `?file=<relativePath>` | `{ success, content, relativePath, sizeBytes }` | `READ_VAULT_FILE` |
| **Workspace Save-All** | `/api/workspace` | `POST` | `{ action: 'save_all', nodes, edges, groups, categories, documents }` | `{ success, cloudSynced, totalItems }` | `SAVE_ALL_WORKSPACE` |
| **Workspace Switch** | `/api/workspace` | `POST` | `{ action: 'configure', path, connectionId }` | `{ success, activePath, isCloudPrimary, storageProvider }` | `CONFIGURE_WORKSPACE` |
| **Workspace Verify** | `/api/workspace` | `POST` | `{ action: 'verify', path }` | `{ success, exists, isDirectory, fileCount }` | `VERIFY_WORKSPACE_PATH` |
| **File / Folder Cascade Purge** | `/api/workspace` | `DELETE` | `?relativePath=<path>` or `{ relativePath }` | `{ success, purgedPath, isDirectory, purgedDocIds, purgedCategoryIds, purgedNodeIds }` | `DELETE_VAULT_FILE` / `DELETE_VAULT_FOLDER` |
| **Document List** | `/api/documents` | `GET` | N/A | `{ success, documents: DocumentItem[] }` | `REFRESH_DOCS` |
| **Document Create / Update** | `/api/documents` | `POST` / `PUT` | `{ document: DocumentItem }` | `{ success, document: DocumentItem }` | `SAVE_DOCUMENT` |
| **Document Delete** | `/api/documents` | `DELETE` | `?id=<docId>` | `{ success, purgedId }` | `DELETE_DOCUMENT` |
| **Category List** | `/api/categories` | `GET` | N/A | `{ success, categories: DocCategory[] }` | `FETCH_CATEGORIES` |
| **Category Save** | `/api/categories` | `POST` / `PUT` | `{ categories: DocCategory[] }` | `{ success, categories }` | `SAVE_CATEGORIES` |
| **Graph Topology** | `/api/graph` | `GET` | N/A | `{ success, nodes, edges, groups }` | `INIT_GRAPH` |
| **Graph Mutation** | `/api/graph` | `POST` | `{ action: 'ADD_NODE'\|'UPDATE_NODE'\|'DELETE_NODE', payload }` | `{ success, graph }` | `MUTATE_GRAPH` |
| **Storage Connections** | `/api/auth/storage/connections` | `GET`, `POST`, `DELETE` | User connection JSON | `{ success, connections, activeConnectionId }` | `SYNC_STORAGE_CONNECTIONS` |
| **Storage Test** | `/api/auth/storage/test` | `POST` | Connection credentials | `{ success, provider, bucketName, latencyMs }` | `TEST_STORAGE_CONNECTION` |
| **Workspaces CRUD** | `/api/auth/workspaces` | `GET`, `POST`, `PUT`, `DELETE` | Workspace metadata | `{ success, workspaces, activeWorkspaceId }` | `MANAGE_WORKSPACES` |
| **Live Telemetry** | `/api/telemetry` | `GET`, `POST` | Telemetry event JSON | `{ success, events }` | `BROADCAST_TELEMETRY` |

---

## 4. ERROR CONTRACT & STATUS CODES
- `200 OK`: Successful synchronous execution with normalized JSON payload `{ success: true, ... }`.
- `400 Bad Request`: Input validation failure or malformed payload. Body contains `{ success: false, error: "SPECIFIC_REASON" }`.
- `401 Unauthorized`: Session token missing or expired.
- `403 Forbidden`: Attempt to access resources outside active vault root.
- `404 Not Found`: Target entity or physical file not found.

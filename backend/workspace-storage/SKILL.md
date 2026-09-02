---
name: workspace-storage-architecture
description: Workspace Storage Architecture specification governing User -> AppUserContext -> Workspace storage hierarchy, decoupled WorkspaceStorageAdapters (Local, iCloud, Google Drive, OneDrive, Supabase, Firebase), provider-independent WorkspaceFS, high-reliability SyncEngine, conflict resolution, and safe detachment semantics. Workspaces use PURE FILESYSTEM STORAGE with ZERO DATABASE ENGINES.
---

# WORKSPACE STORAGE ARCHITECTURE SPECIFICATION

Standardized architectural protocol for Workspace Storage, Multi-Cloud Replication, and Provider-Independent Filesystem operations across local and distributed environments.

---

## 1. System Architectural Hierarchy

$$\text{GlobalUser} \xrightarrow{1:N} \text{AppUserContext} \xrightarrow{1:N} \text{Workspace} \xrightarrow{1:1} \text{PrimaryStorage} \oplus \text{BackupStorages}^{[0..N]}$$

```
                         GLOBAL USER
                              │
                        GLOBAL AUTH
                              │
                    APP USER CONTEXT (appId)
                              │
                     WORKSPACES[] (1..N)
                              │
             ┌────────────────┼────────────────┐
             │                │                │
        WORKSPACE A      WORKSPACE B      WORKSPACE C
             │
       ┌─────┴────────────────┐
       │                      │
    PRIMARY (Canonical)   BACKUPS[] (0..N Replicas)
       │                      │
       │              ┌───────┼────────┬────────┐
       │              │       │        │        │
     LOCAL          iCLOUD  DRIVE   ONEDRIVE  SUPABASE
       │
       ▼
   WorkspaceFS (Provider-Independent Interface)
       │
       ▼
  APPLICATION LOGIC
```

---

## 2. Fundamental Boundary Invariants

$$\text{AdminDatabase} \cap \text{WorkspaceData} = \emptyset$$

1. **Admin Database (Governance & Metadata ONLY)**:
   - User identity & credentials
   - App access & authorizations
   - App-scoped preferences (`AppUserContext.preferences.workspaceOrder`)
   - Workspace definitions & metadata
   - Storage endpoint configurations & sync state
   - **MANDATORY INVARIANT**: Admin database MUST NOT store normal workspace content.
2. **User Storage (Workspace Content = PURE VIRTUAL FILESYSTEM ONLY)**:
   - Project files & folders (stored as `.json`, `.md`, text, and binary assets).
   - **STRICT INVARIANT**: Normal user workspace backends DO NOT use database engines (No SQLite, No Postgres, No Mongo). User data is strictly stored as files in folders.
   - Storage Adapters: **Local Filesystem**, **Apple iCloud Drive**, **Google Drive**, **Microsoft OneDrive**, **Supabase Storage / S3**, **Firebase Storage**.
3. **Canonical Primary vs Replicated Backups**:
   - Each workspace has **exactly 1 Primary Storage** and **0..$N$ Backup Storages**.
   - Primary is the single source of truth; all Backups represent the same workspace.
   - Application reads from and writes to the Primary Storage **only** via `WorkspaceFS`.
   - `SyncEngine` replicates Primary mutations to Backup Storages. Application code NEVER writes directly to backups.
4. **Resilient Failure Handling**:
   - If Primary succeeds and Backup $B$ fails, workspace state remains **VALID**. Backup $B$ is flagged `OUT_OF_SYNC` and queued for retry with exponential backoff.
   - Detaching a storage endpoint removes its link without deleting remote data ($\text{Detach} \neq \text{Delete}$).
   - Restoring from backup is an explicit operation that protects against silent data corruption.

---

## 3. Core Data Structures

### A. User & AppUserContext
```typescript
interface User {
  id: string;
  credentials: AuthCredentials;
  identity: GlobalUserIdentity;
  role: UserRole;
  apps: Record<string, AppUserContext>; // appId -> AppUserContext
  createdAt: number;
  updatedAt: number;
}

interface AppUserContext {
  appId: string;
  enabled: boolean;
  preferences: AppPreferences & { workspaceOrder?: string[] };
  workspaces: Workspace[];
  createdAt: number;
  updatedAt: number;
}
```

### B. Workspace & Storage Endpoint
```typescript
interface Workspace {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  primaryStorage: StorageEndpoint;
  backupStorages: StorageEndpoint[];
  sync: SyncConfiguration;
  preferences: WorkspacePreferences;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface StorageEndpoint {
  id: string;
  provider: "local" | "icloud" | "google_drive" | "onedrive" | "supabase_storage" | "firebase_storage" | "s3";
  configuration: ProviderConfiguration;
  enabled: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "SYNCING" | "ERROR";
  lastSyncAt?: number;
  syncState?: "SYNCED" | "OUT_OF_SYNC" | "PENDING" | "ERROR";
}
```

---

## 4. `WorkspaceStorageAdapter` Interface

All storage providers implement the uniform, decoupled storage adapter contract:

```typescript
interface WorkspaceStorageAdapter {
  readonly provider: StorageProviderType;
  readonly endpointId: string;
  initialize(): Promise<void>;
  exists(pathStr: string): Promise<boolean>;
  stat(pathStr: string): Promise<FileMetadata>;
  list(pathStr?: string): Promise<FileEntry[]>;
  read(pathStr: string): Promise<Uint8Array>;
  write(pathStr: string, data: Uint8Array | Buffer | string): Promise<void>;
  mkdir(pathStr: string): Promise<void>;
  delete(pathStr: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  watch?(pathStr: string, callback: FileChangeCallback): Unsubscribe;
  disconnect(): Promise<void>;
}
```

---

## 5. Sync Engine, Conflict Resolution & Checksums

### Comparison Priority
$$\text{contentHash (SHA-256)} \succ \text{revision (ETag/Generation)} \succ \text{modifiedAt} \succ \text{size}$$

```typescript
interface SyncConfiguration {
  enabled: boolean;
  mode: "on_write" | "interval" | "manual";
  intervalMs?: number;
  conflictStrategy: "primary_wins" | "newest_wins" | "manual";
  deletePropagation: boolean;
  retry: { maxAttempts: number; backoffMs: number };
  verification: { verifyChecksums: boolean; intervalMs?: number };
}
```

### Write Path Flow Chart
```
USER ──► APPLICATION ──► WorkspaceFS.write(path, data)
                              │
                              ▼
                     [Primary Adapter Write]
                              │
                (Success) ────┴──── (Failure)
                    │                    │
                    ▼                    ▼
          [SyncEngine.syncFile()]   [Throw Error, Cancel Sync]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   [Backup 1: OK]        [Backup 2: Fail]
        │                       │
        ▼                       ▼
 [Mark SYNCED]           [Mark OUT_OF_SYNC, Enqueue Retry]
```

---

## 6. Workspace Lifecycle & UI Workflows

1. **Login & Workspace Selection**:
   - `App Start` $\to$ `Authenticate` $\to$ `Resolve Global User` $\to$ `Resolve AppID` $\to$ `AppUserContext` $\to$ Render `KrnlWorkspaceSelector`.
   - Reorder tiles via drag-and-drop atom, storing order in `AppUserContext.preferences.workspaceOrder`.
2. **Open Workspace**:
   - User clicks `KrnlWorkspaceTile` $\to$ Instantiate `WorkspaceRuntime` $\to$ Initialize `WorkspaceFS` & `SyncEngine` $\to$ Validate Primary $\to$ Render Application UI.
3. **Storage Settings (`KrnlWorkspaceStorageSettings`)**:
   - General Settings $\to$ Workspace $\to$ Storage.
   - Primary Storage card with live connection probe.
   - Backup Storages checklist with status badges.
   - **Promote to Primary**: Validate new target $\to$ Compare checksums $\to$ Switch without silent data loss.
   - **Detach Storage**: Disconnects endpoint config without deleting remote files ($\text{Detach} \neq \text{Delete}$).
4. **Dynamic Storage Options Selection & Cloud Bucket Initialization**:
   - Workspace creation dialogues MUST dynamically render user-connected storage options from `savedConnections`.
   - **FORBID static, unremovable "Local Disk Folder" default tiles**. Show only active user-configured storage options with live connectivity status.
   - Upon creating a cloud workspace, automatically initialize the remote bucket hierarchy (`.docustack/workspace_manifest.json`, `.docustack/graph.json`, `.docustack/categories.json`, `.docustack/documents_index.json`, `inbox/WELCOME_TO_{workspace_name}.MD`).
5. **Physical Folder & Kanban Board Cloud Directory Mandate**:
   - Every **Folder Node** created in a workspace graph MUST create a corresponding physical directory on disk and real object prefix in the cloud bucket (`${folderPrefix}/${cleanFolderName}/.keep` and `README.md`).
   - Every **Kanban Board** created in a workspace MUST create a dedicated board folder (`${folderPrefix}/${boardFolderName}/kanban_board.json`) with subfolders for each column (`To_Do/.keep`, `In_Progress/.keep`, `Done/.keep`).
   - Documents belonging to a board column must be stored physically inside `${boardFolderName}/${columnName}/${docName}.md`.
6. **Auto-Save Toggle & Universal `Cmd+S` / `Ctrl+S` Protocol**:
   - The primary application header MUST feature a prominent Auto-Save toggle button with live status indicators (`🟢 AUTO-SAVE ON`, `⚪ AUTO-SAVE OFF`, `⚡ SAVING...`, `✓ SAVED`, `● UNSAVED (CMD+S)`).
   - When Auto-Save is OFF, the system MUST listen for global `Cmd+S` (Mac) / `Ctrl+S` (Windows/Linux) to trigger an atomic full workspace sync (`POST /api/workspace` with `action: 'save_all'`).
   - Client requests MUST automatically inject `Authorization: Bearer <token>` and `x-workspace-id` headers so serverless API routes (`/api/graph`, `/api/categories`, `/api/documents`, `/api/workspace`) can resolve the active workspace storage context via `resolveRequestContextVault(req)`.
7. **Cloud-First Async Loaders & Serverless Awaitable Savers**:
   - In serverless environments (Vercel, AWS Lambda), background un-awaited promises are immediately frozen and terminated upon returning the HTTP response.
   - All workspace mutation routes (`/api/graph`, `/api/categories`, `/api/documents`) MUST `await` all physical filesystem writes and cloud storage network operations (`writeCloudWorkspaceFile`, `syncFolderNodeToCloud`, `syncKanbanNodeToCloud`) prior to responding.
   - When switching or re-entering workspaces, loaders (`loadGraphFromFSAsync`, `loadCategoriesFromFSAsync`, `loadDocumentsFromFSAsync`) MUST read from Cloud Storage (`.docustack/graph.json`, `.docustack/categories.json`, `.docustack/documents_index.json`) when a cloud storage connection is active, cache them to disk, and restore the exact topology without resetting to default initial states.
   - Control plane user accounts (`accounts.json`, `revoked_sessions.json`, `audit_logs.json`) MUST NEVER be stored dynamically under a workspace path; they MUST reside in a fixed canonical root control plane directory (`docustack_vault/.docustack/control_plane`) so user and storage credential resolution survives workspace switches.

---

## 7. Zero-Leak UI & Anti-Copy Invariants (Frontend Governance)

1. **Zero Leakage of Backend / System Jargon in UI**:
   $$\text{RenderedUI} \cap \{ \text{"Control Plane"}, \text{"Data Plane"}, \text{"RBAC"}, \text{"Storage Adapter"}, \text{"SyncEngine"}, \text{"WorkspaceFS"}, \text{"Cluster"}, \text{"Failover"}, \text{"Endpoint ID"} \} = \emptyset$$
   - Backend terms ("Control Plane", "Data Plane", "Storage Adapter", "SyncEngine", "WorkspaceFS", etc.) MUST NEVER be rendered as user-facing headers, labels, or UI views.
   - Use high-level, human-friendly terms ("Account", "Workspaces", "Storage", "Google Drive", "Local", "Replicas").
2. **Zero On-Screen Instructional / Promotional Text**:
   - FORBID direct text descriptions, tutorial paragraphs, marketing copy, or "how-to" guidance rendered into the UI viewport.
   - The UI must be quiet, minimal, and unobtrusive.
3. **Strict Icon-Only Buttons (Zero Text Labels on Buttons)**:
   - Buttons MUST NOT render text labels directly on their surface.
   - Buttons contain strictly monochromatic vector/SVG icons.
   - All button labels, action descriptions, and keyboard shortcuts appear **exclusively on hover tooltips**.


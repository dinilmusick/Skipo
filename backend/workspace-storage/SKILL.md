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
   - Upon creating a cloud workspace, automatically initialize the remote bucket hierarchy (`.docustack/workspace_manifest.json`, `.docustack/graph.json`, `.docustack/categories.json`, `.docustack/documents_index.json`, `Core_Kanban/To_Do/welcome_to_{workspace_name}.md`).
   - **Idempotency Guard**: `initializeCloudWorkspaceBucket` must verify whether `.docustack/graph.json` exists in the bucket first to prevent overwriting user boards or cards upon workspace switches or re-logins.
5. **Physical Folder & Kanban Board Cloud Directory Mandate**:
   - Every **Folder Node** created in a workspace graph MUST create a corresponding physical directory on disk and real object prefix in the cloud bucket (`${folderPrefix}/${cleanFolderName}/.keep` and `README.md`).
   - Every **Kanban Board** created in a workspace MUST create a dedicated board folder (`${folderPrefix}/${boardFolderName}/kanban_board.json`) with subfolders for each column (`To_Do/.keep`, `In_Progress/.keep`, `Done/.keep`).
   - Documents belonging to a board column must be stored physically inside `${boardFolderName}/${columnName}/${docName}.md`.
   - **FORBID dummy fallback folders**: Never dump files into arbitrary legacy folders (`inbox`, `active`, `archive`).
6. **Auto-Save Toggle & Universal `Cmd+S` / `Ctrl+S` Protocol**:
   - The primary application header MUST feature a prominent Auto-Save toggle button with live status indicators (`🟢 AUTO-SAVE ON`, `⚪ AUTO-SAVE OFF`, `⚡ SAVING...`, `✓ SAVED`, `● UNSAVED (CMD+S)`).
   - When Auto-Save is OFF, the system MUST listen for global `Cmd+S` (Mac) / `Ctrl+S` (Windows/Linux) to trigger an atomic full workspace sync (`POST /api/workspace` with `action: 'save_all'`).
   - Client requests MUST automatically inject `Authorization: Bearer <token>` and `x-workspace-id` headers so serverless API routes (`/api/graph`, `/api/categories`, `/api/documents`, `/api/workspace`) can resolve the active workspace storage context via `resolveRequestContextVault(req)`.
7. **Cloud-First Async Loaders & Serverless Awaitable Savers**:
   - In serverless environments (Vercel, AWS Lambda), background un-awaited promises are immediately frozen and terminated upon returning the HTTP response.
   - All workspace mutation routes (`/api/graph`, `/api/categories`, `/api/documents`) MUST `await` all physical filesystem writes and cloud storage network operations (`writeCloudWorkspaceFile`, `syncFolderNodeToCloud`, `syncKanbanNodeToCloud`) prior to responding.
   - When switching or re-entering workspaces, loaders (`loadGraphFromFSAsync`, `loadCategoriesFromFSAsync`, `loadDocumentsFromFSAsync`) MUST read from Cloud Storage (`.docustack/graph.json`, `.docustack/categories.json`, `.docustack/documents_index.json`) when a cloud storage connection is active, cache them to disk, and restore the exact topology without resetting to default initial states.
   - Control plane user accounts (`accounts.json`, `revoked_sessions.json`, `audit_logs.json`) MUST NEVER be stored dynamically under a workspace path; they MUST reside in a fixed canonical root control plane directory (`docustack_vault/.docustack/control_plane`) so user and storage credential resolution survives workspace switches.
8. **Physical Workspace Vault Explorer & Universal Cascade Deletion**:
   - The Physical Workspace Vault Explorer (`WorkspaceExplorerModal`) provides bidirectional inspection and physical deletion of individual files and entire directories.
   - **Single File Purge**: Unlinks the file from disk, purges it from cloud buckets (`deleteCloudWorkspaceFile`), and removes it from `documents_index.json`. The asset immediately disappears from the Kanban column, document table, and UI search.
   - **Directory Cascade Purge**: Deletes all physical files and subfolders from disk, removes all cloud objects under that prefix (`deleteCloudWorkspaceFolder`), discovers and unlinks all contained documents from `documents_index.json`, and cascades deletion to:
     - Attached Kanban Boards (`graph.json` node + edges + `categories.json` columns)
     - Specific Kanban Columns (`categories.json`)
     - Folder Nodes (`graph.json` node + edges)
   - React state dispatches `handleAssetPurged` so the asset vanishes in real time across all tabs (Kanban, Graph, Documents, Media) without requiring a page reload.
9. **Serverless Read-Only Filesystem Fallback & Fault Tolerance**:
   - In serverless runtime environments (such as Vercel Lambdas where `process.cwd()` is read-only at `/var/task`), relative vault paths MUST resolve to `os.tmpdir()` (`/tmp/docustack`).
   - All local disk writes (`fs.writeFileSync`, `fs.mkdirSync`, `fs.rmSync`, `fs.unlinkSync`) MUST be wrapped in safe `try/catch` blocks so that local filesystem write restrictions never abort HTTP requests or crash cloud bucket synchronization to Backblaze B2.
10. **Browser Local Filesystem Access Law & Dual-Mode Explorer Fallback (Brave & Safari Compatibility)**:
    - **Dual-Mode File Picker Strategy**:
      - For Chromium browsers (Chrome, Edge, and Brave with flag enabled), invoke the W3C File System Access API (`window.showDirectoryPicker({ mode: 'readwrite' })`) to obtain a persistent `FileSystemDirectoryHandle`.
      - Store the directory handle in IndexedDB (Database: `DocuStack_LocalFS_Vault`, Store: `directory_handles`, Key: `ws_handle_{timestamp}`) so subsequent sessions seamlessly regain read/write access.
      - Always provide an HTML5 fallback input:
        ```html
        <input type="file" ref={html5FolderInputRef} webkitdirectory directory multiple className="hidden" onChange={handleHtml5FolderSelect} />
        ```
        If `showDirectoryPicker` is unavailable, programmatically trigger this input to guarantee the native OS file explorer (macOS Finder / Windows Explorer) opens without exception.
    - **"Upload" vs "Select" OS Button Discrepancy on macOS**:
      - In macOS Finder, an HTML5 `<input type="file" webkitdirectory>` automatically brands the dialog confirmation button as **"Upload"**.
      - The W3C `window.showDirectoryPicker()` causes macOS Finder to brand the confirmation button with its native **"Select"** label.
    - **Brave Privacy Guard Detection & 1-Click Resolution Protocol**:
      - Brave disables the File System Access API by default for anti-fingerprinting.
      - When Brave is detected (`(navigator as any).brave?.isBrave?.()`), display an amber **Brave Privacy Guard** notification banner with a 1-click **COPY URL** button for `brave://flags/#file-system-access-api`.
      - Instruct the user to set the flag to **Enabled** and relaunch Brave to unlock the native "Select" button and background directory handle write sync.
    - **Error Visibility Surface**: Local storage errors must be rendered directly inside the local storage UI block and never hidden within cloud-only provider blocks.
11. **1:1 Cloud-Identical Local Folder Mirroring Law & Subfolder Encapsulation**:
    - **The Canonical Workspace Subfolder Rule**:
      $$\text{TargetDiskFolder} \xrightarrow{} \text{SelectedRoot} / \text{ultrst\_\{app\}\_\{user\}\_\{workspace\}} / \dots$$
      - When a user selects a local folder (e.g. `/Volumes/D Hard Disk/DocuStack`), local synchronization MUST NEVER dump loose files into the selected folder root.
      - It MUST derive the canonical workspace prefix (`folderPrefix` from `/api/workspace` or `activeWorkspace.workspacePath` formatted as `ultrst_{app}_{user}_{workspace}`) and create that directory inside the selected folder:
        `<SelectedRoot>/ultrst_{app}_{user}_{workspace}/`
    - **Identical 1:1 Directory & File Layout**:
      The local disk folder must be an exact physical mirror of the cloud storage bucket:
      1. `.docustack/` directory:
         - `manifest.json`: workspace metadata, ecosystem tag, total documents, and timestamps.
         - `graph.json`: graph nodes, edges, and groups.
         - `categories.json`: column definitions and category metadata.
         - `documents_index.json`: complete document metadata array.
      2. Folder Nodes:
         - Each `folder`-type graph node creates `<FolderName>/.keep` and `<FolderName>/README.md`.
      3. Kanban Boards & Columns:
         - Each `collection`/`kanban`-type graph node creates `<BoardName>/kanban_board.json`.
         - Subdirectories for each column: `<BoardName>/<ColumnName>/.keep` and `<BoardName>/<ColumnName>/README.md`.
      4. Standalone Categories:
         - Each workspace category also creates a physical root-level directory `<CategoryName>/.keep` and `<CategoryName>/README.md`.
      5. Inbox Directory:
         - Always creates `inbox/.keep` and `inbox/README.md` (or initial welcome guide).
      6. Document Markdown Files:
         - Documents assigned to a board column: `<BoardName>/<ColumnName>/<DocTitle>.md`.
         - Documents assigned to a standalone category: `<CategoryName>/<DocTitle>.md`.
         - Unassigned documents: `inbox/<DocTitle>.md`.
         - Every document MUST include YAML frontmatter (`id`, `title`, `category`, `tags`, `created`).
    - **Prohibition of Static Placeholder Layouts**:
      - Sync engines must NEVER assume or hardcode arbitrary board structures (e.g. forcing `Core_Kanban/To_Do/In_Progress/Done`). Real workspace topology must be dynamically traversed from `nodes` and `categories`.
12. **Storage Tile State Preservation, Star-Toggle Primary, and Concurrency-Safe Clone Replication**:
    - **Interactive Primary Star-Toggle on Every Tile**:
      - Every storage option tile (Primary and Clones) MUST render an interactive star-toggle button (`★ PRIMARY / SET PRIMARY`).
      - Clicking **SET PRIMARY** on any clone promotes it to `role: 'primary'` and demotes all other options to `role: 'redundant_clone'` via `POST /api/auth/storage/connections` (`action: 'set_primary'`).
      - The active primary tile clearly displays a solid gold `★ PRIMARY` badge, while clone tiles display `CLONE`.
    - **Dedicated "SYNC ALL TO CLONES" Control Panel**:
      - A prominent action panel rendered whenever 2+ storage options are registered:
        `SYNC ALL TO CLONES (<N>)`
      - Dispatches serverless cloud replication (`POST /api/auth/storage/sync-clones`) for cloud buckets and direct `syncWorkspaceToDirectoryHandle` for local folders.
      - Individual clone tiles feature dedicated `SYNC` buttons to replicate on demand to a single target.
      - Primary local storage tiles feature a `SYNC DISK` button to refresh local disk files from the active workspace.
    - **Serverless Concurrency-Safe Profile Updating**:
      - In `POST /api/auth/storage/sync-clones`, NEVER overwrite the user profile with an in-memory connection list captured at the start of the request.
      - Fetch a fresh user account from storage (`findUserByIdAsync`) and safely merge connection timestamps by ID. This prevents newly created storage connections on other lambda instances from being dropped.
    - **Client State Non-Destructive Update**:
      - After running clone replication, the client UI MUST NOT perform a destructive full re-fetch (`fetchSavedConnections`) that wipes or re-initializes tiles.
      - Update connection `lastTestedAt` timestamps in local React state directly to keep all tiles intact.
    - **Immediate Initial Local Sync with Live Progress Bar**:
      - Saving or selecting a local folder connection MUST immediately trigger `performLocalHandleSync` to populate disk files with an animated progress bar (percentage, active file, and file counter `N / Total files`).

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


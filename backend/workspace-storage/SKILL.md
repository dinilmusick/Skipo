---
name: workspace-storage-architecture
description: Workspace Storage Architecture specification governing User -> AppUserContext -> Workspace storage hierarchy, decoupled WorkspaceStorageAdapters (Local, iCloud, Google Drive, OneDrive, Supabase, Firebase), provider-independent WorkspaceFS, high-reliability SyncEngine, conflict resolution, and safe detachment semantics. Workspaces use PURE FILESYSTEM STORAGE with ZERO DATABASE ENGINES.
---

# WORKSPACE STORAGE ARCHITECTURE (DENSE)

$$\text{User} \xrightarrow{1:N} \text{AppContext} \xrightarrow{1:N} \text{Workspace} \xrightarrow{1:1} \text{Primary} \oplus \text{Backups}^{[0..N]}$$
$$\text{AdminDB}(\text{MetadataOnly}) \cap \text{WorkspaceData}(\text{VirtualFS}) = \emptyset \quad \wedge \quad \text{Workspace} \cap \text{SQL} = \emptyset$$

## 1. STORAGE HIERARCHY & BOUNDARY INVARIANTS

1. **Admin DB**: Identity, credentials, app metadata, workspace links ONLY. Zero project files.
2. **Workspace Content**: Pure virtual filesystem (`.json`, `.md`, text, assets). ZERO relational database engines inside user workspaces.
3. **Primary vs Backup**: 1 Primary (Single Source of Truth) + $0..N$ Backups (Replicas).
   - App reads/writes **only** to Primary via `WorkspaceFS`.
   - `SyncEngine` replicates changes asynchronously to Backups.
   - Detach $\ne$ Delete: Unlinking a backup preserves remote files.

## 2. WORKSPACE INTERFACE CONTRACT

```typescript
interface WorkspaceFS {
  stat(path: string): Promise<FileStat | null>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array | string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDir(path: string): Promise<FileStat[]>;
  createDir(path: string): Promise<void>;
}

interface Workspace {
  id: string;
  name: string;
  appId: string;
  primaryStorage: StorageEndpoint;      // Local, iCloud, Drive, OneDrive, S3/B2
  backupStorages: StorageEndpoint[];     // 0..N background replicas
  syncStatus: 'SYNCED' | 'OUT_OF_SYNC' | 'REPLICATING' | 'ERROR';
}
```

## 3. ASYNCHRONOUS REPLICATION PIPELINE

```
Client Write -> Primary Storage (Synchronous Commit)
                     │
                     ▼
           SyncEngine Event Trigger
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   Backup A (OK)           Backup B (FAIL)
   Status: SYNCED          Status: OUT_OF_SYNC -> Queue exponential retry (3s -> 60s)
```

## 4. SRKL-BROKERED CLOUD STORAGE & SYSTEM BUCKET ISOLATION

1. **System Buckets vs User Workspace Buckets**:
   - `ultrst-system-buckets` is reserved exclusively for global system-level assets (theme packs, font caches, shared system manifests). It MUST NEVER be used or presented as a workspace storage option for end-users.
   - User workspace cloud storage must be selected from the user's private service accounts (e.g. Backblaze B2, Cloudflare R2, AWS S3) registered under their authenticated account in SRKL.
2. **SRKL Brokering & User-Isolation**:
   - Consumer apps query SRKL directly via the canonical endpoint `https://srkl-engine.vercel.app` (or resolved from `ultrst-srkl-deployments`).
   - All queries pass the user's active session token / user ID so users only see their own storage accounts and buckets.
3. **Zero Passive Polling & Request Minimization**:
   - Storage option dialogs fetch available accounts/buckets once on open (`hasFetchedRef`).
   - Subsequent synchronization is strictly user-triggered via an icon-only `<RefreshCw />` button. No polling on tab or window switches.

## 5. CHECKLIST GATE
`python3 checklists/07_backend_storage_isolation.py .`


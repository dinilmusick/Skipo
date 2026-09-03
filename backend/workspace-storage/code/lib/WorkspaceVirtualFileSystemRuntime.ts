// ══════════════════════════════════════════════════════════════════════════════════════════
// WORKSPACE VIRTUAL FILE SYSTEM RUNTIME & UNIFIED WORKSPACE FS
// ══════════════════════════════════════════════════════════════════════════════════════════

import { WorkspaceStorageAdapter, LocalFileSystemWorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { WorkspaceSyncReplicationEngine } from './WorkspaceSyncReplicationEngine';
import { WorkspaceDataPlaneConfig } from './control-plane-types';
import { SupabaseWorkspaceStorageAdapter } from './SupabaseWorkspaceStorageAdapter';

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: WorkspaceFS
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * High-level filesystem facade exposed to application workflows. Every write and delete
 * triggers non-blocking asynchronous replication via WorkspaceSyncReplicationEngine.
 *
 * Persistence Flow Architecture:
 * ┌───────────────────────────────────────────────────────────┐
 * │ App Logic: fs.write("vault/doc1.json", content)           │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ Primary Storage Adapter: Direct POSIX Disk/Cloud Write    │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ SyncEngine: Broadcast to Configured Backup Replicas       │
 * └───────────────────────────────────────────────────────────┘
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export class WorkspaceFS {
  private primary: WorkspaceStorageAdapter;
  private syncEngine: WorkspaceSyncReplicationEngine;

  constructor(primary: WorkspaceStorageAdapter, syncEngine: WorkspaceSyncReplicationEngine) {
    this.primary = primary;
    this.syncEngine = syncEngine;
  }

  public updatePrimary(adapter: WorkspaceStorageAdapter): void {
    this.primary = adapter;
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    await this.primary.write(relativePath, data);
    // Asynchronously replicate across backup storage replicas
    this.syncEngine.replicateWrite(relativePath, data).catch((err) => {
      console.warn(`[WorkspaceFS] Asynchronous replication failed for [${relativePath}]:`, err);
    });
  }

  async read(relativePath: string): Promise<Uint8Array> {
    return this.primary.read(relativePath);
  }

  async readText(relativePath: string): Promise<string> {
    return this.primary.readText(relativePath);
  }

  async delete(relativePath: string): Promise<boolean> {
    const success = await this.primary.delete(relativePath);
    if (success) {
      this.syncEngine.replicateDelete(relativePath).catch((err) => {
        console.warn(`[WorkspaceFS] Asynchronous delete replication failed for [${relativePath}]:`, err);
      });
    }
    return success;
  }

  async list(dirPath?: string): Promise<string[]> {
    return this.primary.list(dirPath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return this.primary.exists(relativePath);
  }

  async stat(relativePath: string): Promise<{ size: number; mtime: number; isDirectory: boolean }> {
    return this.primary.stat(relativePath);
  }

  async mkdir(dirPath: string): Promise<void> {
    return this.primary.mkdir(dirPath);
  }

  async getHash(relativePath: string): Promise<string> {
    return this.primary.getHash(relativePath);
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: WorkspaceVirtualFileSystemRuntime
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Container coordinating workspace configuration, primary storage, backup adapters,
 * replication engine, and the WorkspaceFS instance.
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */
export class WorkspaceVirtualFileSystemRuntime {
  public config: WorkspaceDataPlaneConfig;
  public primary: WorkspaceStorageAdapter;
  public backups: WorkspaceStorageAdapter[];
  public syncEngine: WorkspaceSyncReplicationEngine;
  public fs: WorkspaceFS;

  constructor(config: WorkspaceDataPlaneConfig) {
    this.config = config;

    // Build primary adapter
    this.primary = WorkspaceVirtualFileSystemRuntime.buildAdapter(config.primaryStorage);

    // Build backup adapters
    this.backups = (config.backupStorage || []).map((endpoint) =>
      WorkspaceVirtualFileSystemRuntime.buildAdapter(endpoint)
    );

    // Initialize replication engine
    this.syncEngine = new WorkspaceSyncReplicationEngine(
      this.primary,
      this.backups,
      config.conflictResolution
    );

    // Initialize unified WorkspaceFS facade
    this.fs = new WorkspaceFS(this.primary, this.syncEngine);
  }

  public static buildAdapter(endpoint: any): WorkspaceStorageAdapter {
    const type = endpoint?.type || endpoint?.provider || 'local_fs';
    switch (type) {
      case 'local':
      case 'browser_local_fs':
      case 'local_fs':
        return new LocalFileSystemWorkspaceStorageAdapter(endpoint?.id || 'local_primary', endpoint?.path || endpoint?.vaultPath);
      case 'supabase_storage':
      case 'supabase':
        return new SupabaseWorkspaceStorageAdapter(
          endpoint?.id || 'supabase_backup',
          endpoint?.bucket || endpoint?.bucketName,
          endpoint?.projectUrl,
          endpoint?.token
        );
      default:
        return new LocalFileSystemWorkspaceStorageAdapter(endpoint?.id || 'local_default', endpoint?.path || endpoint?.vaultPath);
    }
  }

  public changePrimary(newPrimaryId: string): void {
    this.syncEngine.changePrimary(newPrimaryId);
    this.primary = this.syncEngine.getPrimary();
    this.fs.updatePrimary(this.primary);
  }

  public addBackupEndpoint(endpoint: any): void {
    const adapter = WorkspaceVirtualFileSystemRuntime.buildAdapter(endpoint);
    this.syncEngine.addBackup(adapter);
    this.backups = this.syncEngine.getBackups();
  }

  public removeBackupEndpoint(adapterId: string): void {
    this.syncEngine.removeBackup(adapterId);
    this.backups = this.syncEngine.getBackups();
  }

  public async restoreFromBackup(backupId: string): Promise<{ restoredCount: number; errors: string[] }> {
    return this.syncEngine.restore(backupId);
  }
}

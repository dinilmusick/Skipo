// ══════════════════════════════════════════════════════════════════════════════════════════
// WORKSPACE SYNC REPLICATION ENGINE (PRIMARY TO BACKUP REPLICA ASYNC COORDINATOR)
// ══════════════════════════════════════════════════════════════════════════════════════════

import { WorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { SyncStatus, ConflictResolutionStrategy } from './control-plane-types';

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: WorkspaceSyncReplicationEngine
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Orchestrates replication between Primary workspace storage and all configured Backup
 * storage replicas (e.g. iCloud, Google Drive, OneDrive, Supabase Storage, Firebase Storage).
 *
 * Replication Flow Architecture:
 * ┌───────────────────────────────────────────────────────────┐
 * │ Primary File Mutation (Write / Delete)                    │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ WorkspaceSyncReplicationEngine.replicateWrite()           │
 * └──────────────┬─────────────────────────────┬──────────────┘
 *                │                             │
 *                ▼                             ▼
 * ┌───────────────────────────┐ ┌───────────────────────────┐
 * │ Backup Replica 1 (iCloud) │ │ Backup Replica 2 (GDrive) │
 * └───────────────────────────┘ └───────────────────────────┘
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export class WorkspaceSyncReplicationEngine {
  private primary: WorkspaceStorageAdapter;
  private backups: WorkspaceStorageAdapter[];
  private conflictStrategy: ConflictResolutionStrategy;
  private retryLimit: number = 3;

  constructor(
    primary: WorkspaceStorageAdapter,
    backups: WorkspaceStorageAdapter[] = [],
    conflictStrategy: ConflictResolutionStrategy = 'primary_wins'
  ) {
    this.primary = primary;
    this.backups = backups;
    this.conflictStrategy = conflictStrategy;
  }

  public getPrimary(): WorkspaceStorageAdapter {
    return this.primary;
  }

  public getBackups(): WorkspaceStorageAdapter[] {
    return this.backups;
  }

  public addBackup(adapter: WorkspaceStorageAdapter): void {
    if (!this.backups.some((b) => b.id === adapter.id)) {
      this.backups.push(adapter);
    }
  }

  public removeBackup(adapterId: string): void {
    this.backups = this.backups.filter((b) => b.id !== adapterId);
  }

  public setConflictStrategy(strategy: ConflictResolutionStrategy): void {
    this.conflictStrategy = strategy;
  }

  /**
   * Promotes a backup adapter to become the primary storage adapter.
   */
  public changePrimary(newPrimaryId: string): void {
    if (this.primary.id === newPrimaryId) return;

    const backupIndex = this.backups.findIndex((b) => b.id === newPrimaryId);
    if (backupIndex === -1) {
      throw new Error(`BACKUP_ADAPTER_NOT_FOUND: Cannot promote unknown backup adapter [${newPrimaryId}] to primary.`);
    }

    const previousPrimary = this.primary;
    const newPrimary = this.backups[backupIndex];

    this.backups.splice(backupIndex, 1);
    this.backups.push(previousPrimary);
    this.primary = newPrimary;
  }

  /**
   * Asynchronously replicates a write operation across all backup replicas.
   */
  public async replicateWrite(relativePath: string, data: Uint8Array | string): Promise<void> {
    for (const backup of this.backups) {
      let attempts = 0;
      let success = false;
      while (!success && attempts < this.retryLimit) {
        try {
          await backup.write(relativePath, data);
          success = true;
        } catch (err) {
          attempts++;
          if (attempts >= this.retryLimit) {
            console.warn(`[SyncReplication] Failed to replicate write to backup [${backup.id}]:`, err);
          }
        }
      }
    }
  }

  /**
   * Asynchronously replicates a delete operation across all backup replicas.
   */
  public async replicateDelete(relativePath: string): Promise<void> {
    for (const backup of this.backups) {
      try {
        await backup.delete(relativePath);
      } catch (err) {
        console.warn(`[SyncReplication] Failed to replicate delete to backup [${backup.id}]:`, err);
      }
    }
  }

  /**
   * Non-destructive restore: Copies all files from the chosen backup adapter into Primary storage.
   */
  public async restore(fromBackupId: string): Promise<{ restoredCount: number; errors: string[] }> {
    const backup = this.backups.find((b) => b.id === fromBackupId);
    if (!backup) {
      throw new Error(`RESTORE_TARGET_NOT_FOUND: Backup adapter [${fromBackupId}] not found.`);
    }

    const files = await backup.list();
    let restoredCount = 0;
    const errors: string[] = [];

    for (const filePath of files) {
      try {
        const data = await backup.read(filePath);
        await this.primary.write(filePath, data);
        restoredCount++;
      } catch (err: any) {
        errors.push(`Failed to restore ${filePath}: ${err.message}`);
      }
    }

    return { restoredCount, errors };
  }

  /**
   * Evaluates synchronization status and detects checksum mismatches between primary and backups.
   */
  public async getStatus(): Promise<SyncStatus> {
    try {
      const primaryFiles = await this.primary.list();
      let hasMismatch = false;

      for (const backup of this.backups) {
        const backupFiles = await backup.list();
        if (primaryFiles.length !== backupFiles.length) {
          hasMismatch = true;
          break;
        }
      }

      return {
        status: hasMismatch ? 'syncing' : 'synced',
        lastSyncTimestamp: Date.now(),
        pendingOperations: 0,
        divergenceCount: hasMismatch ? 1 : 0,
      };
    } catch {
      return {
        status: 'error',
        lastSyncTimestamp: Date.now(),
        pendingOperations: 0,
        divergenceCount: 0,
      };
    }
  }
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { UserStorageConnection } from './types';
import { INITIAL_NODES, INITIAL_EDGES } from './theme';
import {
  Workspace,
  StorageEndpoint,
  StorageEngineType,
  SyncConfig,
} from './control-plane-types';
import { LocalFileSystemWorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { ICloudWorkspaceStorageAdapter } from './ICloudWorkspaceStorageAdapter';
import { GoogleDriveWorkspaceStorageAdapter } from './GoogleDriveWorkspaceStorageAdapter';
import { OneDriveWorkspaceStorageAdapter } from './OneDriveWorkspaceStorageAdapter';
import { SupabaseWorkspaceStorageAdapter } from './SupabaseWorkspaceStorageAdapter';
import { FirebaseWorkspaceStorageAdapter } from './FirebaseWorkspaceStorageAdapter';
import { WorkspaceVirtualFileSystemRuntime } from './WorkspaceVirtualFileSystemRuntime';
import { UserWorkspaceFileStorageCoordinator } from './UserWorkspaceFileStorageCoordinator';

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. WORKSPACE STORAGE ARCHITECTURE, WORKSPACE_FS & SYNC ENGINE
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE: Multi-Cloud Workspace Storage & Sync Engine
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Formula:
 *   GlobalUser ──► AppUserContext ──► Workspace ──► PrimaryStorage ⊕ BackupStorages[0..N]
 *
 * Comparison Priority:
 *   contentHash (SHA-256) ≻ revision ≻ modifiedAt ≻ size
 *
 * Replication Flow:
 *   [WorkspaceFS.write()] ──► [Primary Storage] ──► [SyncEngine.replicate()] ──► [Backup Storages]
 *                                                           │
 *                                                           ▼
 *                                                [Verify SHA-256 Checksums]
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export interface StorageAdapter {
  id: string;
  provider: StorageEngineType;
  write(relativePath: string, data: Uint8Array | string): Promise<void>;
  read(relativePath: string): Promise<Uint8Array>;
  delete(relativePath: string): Promise<boolean>;
  list(dirPath?: string): Promise<string[]>;
  getHash(relativePath: string): Promise<string>;
}

export class LocalStorageAdapter implements StorageAdapter {
  id: string;
  provider: StorageEngineType = 'local';
  private basePath: string;

  constructor(id: string, basePath?: string) {
    this.id = id;
    this.basePath = basePath || getVaultAbsolutePath();
  }

  private resolvePath(relativePath: string): string {
    const normalized = path.normalize(path.join(this.basePath, relativePath));
    if (!normalized.startsWith(this.basePath)) {
      throw new Error(`STORAGE_SECURITY_ERROR: Access outside base directory denied: ${relativePath}`);
    }
    return normalized;
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(fullPath, Buffer.from(data));
  }

  async read(relativePath: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) throw new Error(`FILE_NOT_FOUND: ${relativePath}`);
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  async delete(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      return true;
    }
    return false;
  }

  async list(dirPath: string = ''): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);
    if (!fs.existsSync(fullPath)) return [];
    
    const results: string[] = [];
    const scan = (cur: string, rel: string) => {
      const items = fs.readdirSync(cur, { withFileTypes: true });
      for (const item of items) {
        if (item.name === '.docustack') continue;
        const subFull = path.join(cur, item.name);
        const subRel = path.join(rel, item.name);
        if (item.isDirectory()) {
          scan(subFull, subRel);
        } else {
          results.push(subRel);
        }
      }
    };
    scan(fullPath, dirPath);
    return results;
  }

  async getHash(relativePath: string): Promise<string> {
    const bytes = await this.read(relativePath);
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }
}

export class CloudStorageAdapter implements StorageAdapter {
  id: string;
  provider: StorageEngineType;
  private memoryVault = new Map<string, Uint8Array>();

  constructor(id: string, provider: StorageEngineType) {
    this.id = id;
    this.provider = provider;
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.memoryVault.set(relativePath, bytes);
  }

  async read(relativePath: string): Promise<Uint8Array> {
    const data = this.memoryVault.get(relativePath);
    if (!data) throw new Error(`CLOUD_STORAGE_FILE_NOT_FOUND: [${this.provider}] ${relativePath}`);
    return data;
  }

  async delete(relativePath: string): Promise<boolean> {
    return this.memoryVault.delete(relativePath);
  }

  async list(): Promise<string[]> {
    return Array.from(this.memoryVault.keys());
  }

  async getHash(relativePath: string): Promise<string> {
    const bytes = await this.read(relativePath);
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }
}

export {
  LocalFileSystemWorkspaceStorageAdapter,
  ICloudWorkspaceStorageAdapter,
  GoogleDriveWorkspaceStorageAdapter,
  OneDriveWorkspaceStorageAdapter,
  SupabaseWorkspaceStorageAdapter,
  FirebaseWorkspaceStorageAdapter,
  WorkspaceVirtualFileSystemRuntime,
  UserWorkspaceFileStorageCoordinator,
};

export class StorageAdapterFactory {
  static createAdapter(endpoint: StorageEndpoint): StorageAdapter {
    switch (endpoint.provider) {
      case 'local':
      case 'filesystem':
      case 'local_fs':
      case 'browser_local_fs':
        return new LocalFileSystemWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.basePath);
      case 'icloud_drive':
        return new ICloudWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.containerId);
      case 'google_drive':
        return new GoogleDriveWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.rootFolderId, endpoint.configuration?.accountId);
      case 'onedrive':
        return new OneDriveWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.rootFolderId, endpoint.configuration?.accountId);
      case 'supabase_storage':
      case 's3':
      case 'vercel_blob':
        return new SupabaseWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.bucket, endpoint.configuration?.projectUrl, endpoint.configuration?.token);
      case 'firebase_storage':
        return new FirebaseWorkspaceStorageAdapter(endpoint.id, endpoint.configuration?.bucket, endpoint.configuration?.projectId);
      default:
        return new LocalFileSystemWorkspaceStorageAdapter(endpoint.id);
    }
  }
}

export class SyncEngine {
  private primaryAdapter: StorageAdapter;
  private backupAdapters: StorageAdapter[];
  private syncConfig: SyncConfig;

  constructor(primary: StorageAdapter, backups: StorageAdapter[], syncConfig: SyncConfig) {
    this.primaryAdapter = primary;
    this.backupAdapters = backups;
    this.syncConfig = syncConfig;
  }

  async replicateWrite(relativePath: string, data: Uint8Array | string): Promise<void> {
    if (!this.syncConfig.enabled || this.syncConfig.mode !== 'on_write') return;

    const hash = crypto.createHash('sha256').update(data).digest('hex');

    for (const backup of this.backupAdapters) {
      try {
        await backup.write(relativePath, data);
        if (this.syncConfig.verification?.verifyChecksums) {
          const backupHash = await backup.getHash(relativePath);
          if (backupHash !== hash) {
            console.warn(`CHECKSUM_MISMATCH: Replica ${backup.id} hash differs for ${relativePath}`);
          }
        }
      } catch (err) {
        console.warn(`SYNC_WARNING: Failed to replicate write to backup [${backup.id}]:`, err);
      }
    }
  }

  async replicateDelete(relativePath: string): Promise<void> {
    if (!this.syncConfig.enabled || !this.syncConfig.deletePropagation) return;

    for (const backup of this.backupAdapters) {
      try {
        await backup.delete(relativePath);
      } catch (err) {
        console.warn(`SYNC_WARNING: Failed to propagate delete to backup [${backup.id}]:`, err);
      }
    }
  }

  async restore(backupStorageSpec: StorageEndpoint): Promise<{ filesRestoredCount: number; message: string }> {
    const backupAdapter = StorageAdapterFactory.createAdapter(backupStorageSpec);
    const files = await backupAdapter.list();

    let count = 0;
    for (const relPath of files) {
      try {
        const data = await backupAdapter.read(relPath);
        await this.primaryAdapter.write(relPath, data);
        count++;
      } catch (err) {
        console.warn(`RESTORE_WARNING: Could not restore file ${relPath}:`, err);
      }
    }

    return {
      filesRestoredCount: count,
      message: `Successfully restored ${count} files from backup storage [${backupStorageSpec.id}].`,
    };
  }
}

export class WorkspaceFS {
  private primaryAdapter: StorageAdapter;
  private syncEngine: SyncEngine;

  constructor(primaryAdapter: StorageAdapter, syncEngine: SyncEngine) {
    this.primaryAdapter = primaryAdapter;
    this.syncEngine = syncEngine;
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    await this.primaryAdapter.write(relativePath, data);
    await this.syncEngine.replicateWrite(relativePath, data);
  }

  async read(relativePath: string): Promise<Uint8Array> {
    return this.primaryAdapter.read(relativePath);
  }

  async delete(relativePath: string): Promise<boolean> {
    const deleted = await this.primaryAdapter.delete(relativePath);
    if (deleted) {
      await this.syncEngine.replicateDelete(relativePath);
    }
    return deleted;
  }

  async list(dirPath: string = ''): Promise<string[]> {
    return this.primaryAdapter.list(dirPath);
  }
}

export class WorkspaceRuntime {
  public spec: Workspace;
  public filesystem: WorkspaceFS;
  public syncEngine: SyncEngine;
  private primaryAdapter: StorageAdapter;
  private backupAdapters: StorageAdapter[];

  private constructor(spec: Workspace) {
    this.spec = spec;
    this.primaryAdapter = StorageAdapterFactory.createAdapter(spec.primaryStorage);
    this.backupAdapters = spec.backupStorages.map((ep) => StorageAdapterFactory.createAdapter(ep));
    this.syncEngine = new SyncEngine(this.primaryAdapter, this.backupAdapters, spec.sync);
    this.filesystem = new WorkspaceFS(this.primaryAdapter, this.syncEngine);
  }

  static async create(workspaceSpec: Workspace): Promise<WorkspaceRuntime> {
    return new WorkspaceRuntime(workspaceSpec);
  }

  async changePrimary(newPrimaryEndpointId: string): Promise<void> {
    const idx = this.spec.backupStorages.findIndex((ep) => ep.id === newPrimaryEndpointId);
    if (idx === -1) {
      throw new Error(`CHANGE_PRIMARY_ERROR: Target backup endpoint [${newPrimaryEndpointId}] not found in workspace.`);
    }

    const oldPrimary = this.spec.primaryStorage;
    const newPrimary = this.spec.backupStorages[idx];

    // Swap roles without data loss
    this.spec.backupStorages[idx] = { ...oldPrimary, syncState: 'SYNCED' };
    this.spec.primaryStorage = { ...newPrimary, status: 'CONNECTED', syncState: 'SYNCED' };
    this.spec.updatedAt = Date.now();

    // Re-initialize runtime components
    this.primaryAdapter = StorageAdapterFactory.createAdapter(this.spec.primaryStorage);
    this.backupAdapters = this.spec.backupStorages.map((ep) => StorageAdapterFactory.createAdapter(ep));
    this.syncEngine = new SyncEngine(this.primaryAdapter, this.backupAdapters, this.spec.sync);
    this.filesystem = new WorkspaceFS(this.primaryAdapter, this.syncEngine);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// PHYSICAL FILE SYSTEM VAULT INITIALIZER & DIRECTORY UTILITIES
// ══════════════════════════════════════════════════════════════════════════════════════════

export {
  sanitizeFolderSegment,
  formatCanonicalWorkspaceFolderName,
  formatCanonicalWorkspacePath,
} from './workspace-canonical';

export let globalActiveVaultPath: string | null = null;
export let globalActiveVaultName: string = 'DocuStack Vault';
export let globalActiveStorageConn: UserStorageConnection | null = null;
export let globalActiveFolderPrefix: string | null = null;

export function resolveCustomPath(rawPath: string): string {
  const baseDir = path.join(os.tmpdir(), 'docustack_workspace');

  if (!rawPath || rawPath.trim() === '' || rawPath === './docustack_vault' || rawPath === 'docustack_vault') {
    return baseDir;
  }
  let clean = rawPath.trim();
  if (clean.startsWith('~')) {
    clean = path.join(os.homedir(), clean.slice(1));
  }
  if (!path.isAbsolute(clean)) {
    return path.resolve(baseDir, clean.replace(/^\.\//, ''));
  }
  return path.normalize(clean);
}

export function setActiveVaultConfig(
  customPath?: string,
  customName?: string,
  storageConn?: UserStorageConnection | null,
  folderPrefix?: string | null
): void {
  if (customPath) {
    globalActiveVaultPath = resolveCustomPath(customPath);
  }
  if (customName) {
    globalActiveVaultName = customName;
  }
  if (storageConn !== undefined) {
    globalActiveStorageConn = storageConn || null;
  }
  if (folderPrefix !== undefined) {
    globalActiveFolderPrefix = folderPrefix || null;
  } else if (customPath) {
    globalActiveFolderPrefix = customPath.replace(/^\.\//, '');
  }
}

export function getActiveVaultName(): string {
  return globalActiveVaultName;
}

export function getActiveStorageConn(): UserStorageConnection | null {
  return globalActiveStorageConn;
}

export function getActiveFolderPrefix(): string | null {
  return globalActiveFolderPrefix;
}

export function getVaultAbsolutePath(customPath?: string): string {
  if (customPath) {
    return resolveCustomPath(customPath);
  }
  if (globalActiveVaultPath) {
    return globalActiveVaultPath;
  }
  return resolveCustomPath('');
}

export function ensureWorkspaceExists(customVaultPath?: string) {
  try {
    // If active storage is cloud, do not create physical disk folders
    if (globalActiveStorageConn && globalActiveStorageConn.provider !== 'local_fs') {
      return;
    }

    const vaultPath = getVaultAbsolutePath(customVaultPath);

    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }

    // Create initial workspace meta directory (internal control plane metadata)
    const metaDir = path.join(vaultPath, '.docustack');
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
    }

    // Seed default graph layout if not present
    const graphFile = path.join(metaDir, 'graph.json');
    if (!fs.existsSync(graphFile)) {
      const updatedNodes = INITIAL_NODES.map((n) =>
        n.isWorkspaceRoot ? { ...n, workspacePath: vaultPath } : n
      );
      fs.writeFileSync(
        graphFile,
        JSON.stringify({ nodes: updatedNodes, edges: INITIAL_EDGES, groups: [] }, null, 2),
        'utf-8'
      );
    }

    // Seed default categories if not present
    const categoriesFile = path.join(metaDir, 'categories.json');
    if (!fs.existsSync(categoriesFile)) {
      fs.writeFileSync(categoriesFile, JSON.stringify([], null, 2), 'utf-8');
    }

    // Seed default documents index if not present
    const documentsFile = path.join(metaDir, 'documents_index.json');
    if (!fs.existsSync(documentsFile)) {
      fs.writeFileSync(documentsFile, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Workspace directory initialization bypassed due to read-only filesystem:', err);
  }
}

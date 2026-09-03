import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { DocumentItem, DocCategory, GraphNode, GraphEdge, GraphGroup, UserStorageConnection } from './types';
import { INITIAL_CATEGORIES, INITIAL_DOCUMENTS, INITIAL_NODES, INITIAL_EDGES } from './theme';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  deleteCloudWorkspaceFile,
  deleteCloudWorkspaceFolder,
  initializeCloudWorkspaceBucket,
  syncFolderNodeToCloud,
  syncKanbanNodeToCloud,
  syncEntireWorkspaceToCloud,
  getSafeCloudFolderName,
} from './cloud-storage-service';
import {
  Workspace,
  StorageEndpoint,
  StorageEngineType,
  SyncConfig,
} from './control-plane-types';

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

import { LocalFileSystemWorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { ICloudWorkspaceStorageAdapter } from './ICloudWorkspaceStorageAdapter';
import { GoogleDriveWorkspaceStorageAdapter } from './GoogleDriveWorkspaceStorageAdapter';
import { OneDriveWorkspaceStorageAdapter } from './OneDriveWorkspaceStorageAdapter';
import { SupabaseWorkspaceStorageAdapter } from './SupabaseWorkspaceStorageAdapter';
import { FirebaseWorkspaceStorageAdapter } from './FirebaseWorkspaceStorageAdapter';
import { WorkspaceVirtualFileSystemRuntime } from './WorkspaceVirtualFileSystemRuntime';
import { UserWorkspaceFileStorageCoordinator } from './UserWorkspaceFileStorageCoordinator';

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

const VAULT_DIR_NAME = 'docustack_vault';
let globalActiveVaultPath: string | null = null;
let globalActiveVaultName: string = 'DocuStack Vault';
let globalActiveStorageConn: UserStorageConnection | null = null;
let globalActiveFolderPrefix: string | null = null;

export function resolveCustomPath(rawPath: string): string {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const baseDir = isServerless ? path.join(os.tmpdir(), 'docustack') : process.cwd();

  if (!rawPath || rawPath.trim() === '') {
    return path.join(baseDir, VAULT_DIR_NAME);
  }
  let clean = rawPath.trim();
  if (clean.startsWith('~')) {
    clean = path.join(os.homedir(), clean.slice(1));
  }
  if (isServerless && !path.isAbsolute(clean)) {
    return path.resolve(baseDir, clean.replace(/^\.\//, ''));
  }
  return path.isAbsolute(clean) ? path.normalize(clean) : path.resolve(process.cwd(), clean);
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

// ----------------------------------------------------------------------
// DOCUMENTS FS HANDLERS
// ----------------------------------------------------------------------

export function loadDocumentsFromFS(): DocumentItem[] {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  if (!fs.existsSync(indexFile)) {
    return INITIAL_DOCUMENTS;
  }

  try {
    const raw = fs.readFileSync(indexFile, 'utf-8');
    const docs: DocumentItem[] = JSON.parse(raw);

    // Verify each doc's physical file on disk and re-read actual content
    return docs.map((doc) => {
      if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
        try {
          const diskContent = fs.readFileSync(doc.fileUrl, 'utf-8');
          const stat = fs.statSync(doc.fileUrl);
          return {
            ...doc,
            content: diskContent,
            fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
          };
        } catch {
          return doc;
        }
      }
      return doc;
    });
  } catch (err) {
    console.error('Error reading documents index from FS:', err);
    return INITIAL_DOCUMENTS;
  }
}

export async function loadDocumentsFromFSAsync(): Promise<DocumentItem[]> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json'
      );
      if (cloudRaw) {
        const cloudDocs: DocumentItem[] = JSON.parse(cloudRaw);
        if (Array.isArray(cloudDocs) && cloudDocs.length > 0) {
          try {
            fs.writeFileSync(indexFile, cloudRaw, 'utf-8');
          } catch {}
          return cloudDocs;
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadDocumentsFromFSAsync fallback:', e);
    }
  }

  return loadDocumentsFromFS();
}

/**
 * Dynamically resolves the physical directory and full relative path for a document
 * based on the user's actual Kanban boards, categories (columns), and folder nodes.
 *
 * Pattern:
 * - Kanban card: <Board_Folder>/<Column_Folder>/<filename>.md
 * - Independent category card: <Category_Folder>/<filename>.md
 * - Folder document: <Folder_Name>/<filename>.md
 * - Root document: <filename>.md
 *
 * Never falls back to dummy legacy folders like 'inbox'.
 */
export function resolveDocumentStoragePath(
  doc: DocumentItem,
  categories?: DocCategory[],
  nodes?: GraphNode[]
): { folderPath: string; fullRelativePath: string; fileName: string } {
  const currentCategories = categories || loadCategoriesFromFS();
  let currentNodes = nodes;
  if (!currentNodes) {
    try {
      currentNodes = loadGraphFromFS().nodes;
    } catch {
      currentNodes = [];
    }
  }

  let folderPath = '';
  const assignedCat = currentCategories.find((c) => c.id === doc.categoryId);

  if (assignedCat) {
    const catFolder = getSafeCloudFolderName(assignedCat.title);
    if (assignedCat.boardId) {
      const boardNode = currentNodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
      const boardFolder = getSafeCloudFolderName(boardNode?.title || 'Kanban_Board');
      folderPath = `${boardFolder}/${catFolder}`;
    } else {
      folderPath = catFolder;
    }
  } else if (doc.categoryId) {
    const folderNode = currentNodes.find(
      (n) => n.id === doc.categoryId || n.title === doc.categoryId
    );
    if (folderNode) {
      folderPath = getSafeCloudFolderName(folderNode.title);
    }
  }

  const safeFileName = (doc.title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .concat(doc.title && doc.title.includes('.') ? '' : '.md');

  const fullRelativePath = folderPath ? `${folderPath}/${safeFileName}` : safeFileName;

  return { folderPath, fullRelativePath, fileName: safeFileName };
}

export async function saveDocumentToFSAsync(doc: DocumentItem): Promise<DocumentItem> {
  const updatedDoc = saveDocumentToFS(doc);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const { fullRelativePath } = resolveDocumentStoragePath(doc);
    const fileContent = doc.content || '# ' + doc.title;
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        fullRelativePath,
        fileContent,
        doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
      );
      const currentDocs = loadDocumentsFromFS();
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json',
        JSON.stringify(currentDocs, null, 2),
        'application/json'
      );
    } catch (err) {
      console.warn('[CloudStorage] saveDocumentToFSAsync error:', err);
    }
  }

  return updatedDoc;
}

export function saveDocumentToFS(doc: DocumentItem): DocumentItem {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  const currentDocs = loadDocumentsFromFS();
  const existingIndex = currentDocs.findIndex((d) => d.id === doc.id);
  const existingDoc = existingIndex >= 0 ? currentDocs[existingIndex] : undefined;

  const { folderPath, fullRelativePath } = resolveDocumentStoragePath(doc);
  const physicalPath = path.join(vaultPath, fullRelativePath);

  let fileSizeFormatted = doc.fileSize || '1.0 KB';

  try {
    const targetDir = folderPath ? path.join(vaultPath, folderPath) : vaultPath;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // If document moved between categories/folders, unlink old physical path
    if (existingDoc?.fileUrl && existingDoc.fileUrl !== physicalPath && fs.existsSync(existingDoc.fileUrl)) {
      try {
        fs.unlinkSync(existingDoc.fileUrl);
      } catch {}
    }

    // Write content directly to physical disk file
    fs.writeFileSync(physicalPath, doc.content || '# ' + doc.title, 'utf-8');
    const stat = fs.statSync(physicalPath);
    fileSizeFormatted = `${(stat.size / 1024).toFixed(1)} KB`;
  } catch (fsErr) {
    console.warn('[workspaceFS] Local document disk write bypassed (read-only filesystem):', fsErr);
  }

  const updatedDoc: DocumentItem = {
    ...doc,
    fileUrl: physicalPath,
    fileSize: fileSizeFormatted,
  };

  let updatedDocsList: DocumentItem[];
  if (existingIndex >= 0) {
    updatedDocsList = [...currentDocs];
    updatedDocsList[existingIndex] = updatedDoc;
  } else {
    updatedDocsList = [updatedDoc, ...currentDocs];
  }

  try {
    fs.writeFileSync(indexFile, JSON.stringify(updatedDocsList, null, 2), 'utf-8');
  } catch {}

  // Sync directly to Cloud Storage (Backblaze B2, R2, S3, Supabase) if active
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const fileContent = doc.content || '# ' + doc.title;
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      fullRelativePath,
      fileContent,
      doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
    ).catch((err) => console.warn('[CloudStorage] write file error:', err));

    // If file moved in cloud storage, remove old cloud object
    if (existingDoc) {
      const oldResolved = resolveDocumentStoragePath(existingDoc);
      if (oldResolved.fullRelativePath !== fullRelativePath) {
        deleteCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          oldResolved.fullRelativePath
        ).catch(() => {});
      }
    }

    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/documents_index.json',
      JSON.stringify(updatedDocsList, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] index update error:', err));
  }

  return updatedDoc;
}

export function deleteDocumentFromFS(docId: string): boolean {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  const currentDocs = loadDocumentsFromFS();
  const target = currentDocs.find((d) => d.id === docId);

  if (target && target.fileUrl && fs.existsSync(target.fileUrl)) {
    try {
      fs.unlinkSync(target.fileUrl);
    } catch (e) {
      console.warn('Could not delete physical file from disk:', e);
    }
  }

  const remaining = currentDocs.filter((d) => d.id !== docId);
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remaining, null, 2), 'utf-8');
  } catch {}

  // Sync deletion to Cloud Storage if active
  if (globalActiveStorageConn && globalActiveFolderPrefix && target) {
    const { fullRelativePath } = resolveDocumentStoragePath(target);

    deleteCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      fullRelativePath
    ).catch((err) => console.warn('[CloudStorage] delete file error:', err));

    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/documents_index.json',
      JSON.stringify(remaining, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] delete index update error:', err));
  }

  return true;
}

export function deleteCategoryAndDocumentsFromFS(categoryId: string): { purgedDocsCount: number; purgedCategory: boolean } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const catFile = path.join(metaDir, 'categories.json');
  const indexFile = path.join(metaDir, 'documents_index.json');

  // 1. Remove category from categories.json
  const currentCategories = loadCategoriesFromFS();
  const remainingCategories = currentCategories.filter((c) => c.id !== categoryId);
  try {
    fs.writeFileSync(catFile, JSON.stringify(remainingCategories, null, 2), 'utf-8');
  } catch {}

  // 2. Remove all documents matching categoryId from documents_index.json and unlink physical files
  const currentDocs = loadDocumentsFromFS();
  const docsToDelete = currentDocs.filter((d) => d.categoryId === categoryId);
  for (const doc of docsToDelete) {
    if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
      try {
        fs.unlinkSync(doc.fileUrl);
      } catch (e) {
        console.warn('Could not delete physical file for doc:', doc.id, e);
      }
    }
  }

  const remainingDocs = currentDocs.filter((d) => d.categoryId !== categoryId);
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remainingDocs, null, 2), 'utf-8');
  } catch {}

  return { purgedDocsCount: docsToDelete.length, purgedCategory: true };
}

export interface PurgeAssetResult {
  success: boolean;
  purgedPath: string;
  isDirectory: boolean;
  purgedDocIds: string[];
  purgedCategoryIds: string[];
  purgedNodeIds: string[];
  message: string;
}

/**
 * Universal physical asset purger: handles deleting files OR entire folders from
 * physical disk and cloud storage, cascading to manifests, categories, and graph nodes.
 */
export async function purgeAssetFromPhysicalWorkspace(relativePath: string): Promise<PurgeAssetResult> {
  ensureWorkspaceExists();
  const cleanRel = relativePath.replace(/^\/+|\/+$/g, '');
  if (!cleanRel) {
    return {
      success: false,
      purgedPath: relativePath,
      isDirectory: false,
      purgedDocIds: [],
      purgedCategoryIds: [],
      purgedNodeIds: [],
      message: 'EMPTY_PATH',
    };
  }

  const vaultPath = getVaultAbsolutePath();
  const targetPath = path.normalize(path.join(vaultPath, cleanRel));

  // Determine if target is a directory
  let isDirectory = false;
  if (fs.existsSync(targetPath)) {
    try {
      isDirectory = fs.statSync(targetPath).isDirectory();
    } catch {}
  } else {
    // If not on local disk (e.g. cloud-only/serverless), check extension
    const hasExt = path.extname(cleanRel).length > 0;
    isDirectory = !hasExt;
  }

  const purgedDocIds: string[] = [];
  const purgedCategoryIds: string[] = [];
  const purgedNodeIds: string[] = [];

  const currentDocs = loadDocumentsFromFS();
  let remainingDocs = [...currentDocs];

  if (isDirectory) {
    // 1. Discover all documents whose storage path resides inside this directory
    const folderPrefixWithSlash = `${cleanRel}/`;
    for (const doc of currentDocs) {
      const { fullRelativePath } = resolveDocumentStoragePath(doc);
      if (fullRelativePath.startsWith(folderPrefixWithSlash) || fullRelativePath === cleanRel) {
        purgedDocIds.push(doc.id);
      }
    }

    remainingDocs = currentDocs.filter((d) => !purgedDocIds.includes(d.id));

    // 2. Remove directory from local disk
    try {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('[workspaceFS] Local folder rmSync warning:', e);
    }

    // 3. Remove from Cloud Storage
    if (globalActiveStorageConn && globalActiveFolderPrefix) {
      try {
        await deleteCloudWorkspaceFolder(globalActiveStorageConn, globalActiveFolderPrefix, cleanRel);
      } catch (cloudErr) {
        console.warn('[CloudStorage] deleteCloudWorkspaceFolder warning:', cloudErr);
      }
    }

    // 4. Check if directory maps to a Kanban Board, Kanban Column, or Folder Node
    const currentCategories = loadCategoriesFromFS();
    let updatedCategories = [...currentCategories];

    const currentGraph = await loadGraphFromFSAsync();
    let updatedNodes = [...currentGraph.nodes];
    let updatedEdges = [...currentGraph.edges];

    // Check if matching a Board node
    const matchingBoardNode = currentGraph.nodes.find(
      (n) =>
        (n.type === 'collection' || n.glyph === 'Kanban') &&
        (getSafeCloudFolderName(n.title) === cleanRel || n.title === cleanRel)
    );

    if (matchingBoardNode) {
      const boardId = matchingBoardNode.collectionId || matchingBoardNode.id;
      purgedNodeIds.push(matchingBoardNode.id);
      updatedNodes = updatedNodes.filter((n) => n.id !== matchingBoardNode.id);
      updatedEdges = updatedEdges.filter(
        (e) => e.source !== matchingBoardNode.id && e.target !== matchingBoardNode.id
      );

      // Purge all categories associated with this board
      const boardCategories = currentCategories.filter((c) => c.boardId === boardId);
      for (const cat of boardCategories) {
        purgedCategoryIds.push(cat.id);
      }
      updatedCategories = updatedCategories.filter((c) => c.boardId !== boardId);
    }

    // Check if matching a Folder Node on canvas
    const matchingFolderNode = currentGraph.nodes.find(
      (n) =>
        (n.type === 'folder' || n.glyph === 'Folder') &&
        (getSafeCloudFolderName(n.title) === cleanRel || n.title === cleanRel)
    );
    if (matchingFolderNode) {
      purgedNodeIds.push(matchingFolderNode.id);
      updatedNodes = updatedNodes.filter((n) => n.id !== matchingFolderNode.id);
      updatedEdges = updatedEdges.filter(
        (e) => e.source !== matchingFolderNode.id && e.target !== matchingFolderNode.id
      );
    }

    // Check if matching a specific Kanban Column (e.g. "BoardName/ColumnName" or "ColumnName")
    const matchingCategory = currentCategories.find((c) => {
      const safeCat = getSafeCloudFolderName(c.title);
      if (c.boardId) {
        const bNode = currentGraph.nodes.find((n) => (n.collectionId || n.id) === c.boardId);
        if (bNode) {
          const bFolder = getSafeCloudFolderName(bNode.title || 'Kanban_Board');
          return `${bFolder}/${safeCat}` === cleanRel || `${bFolder}/${c.title}` === cleanRel;
        }
      }
      return safeCat === cleanRel || c.title === cleanRel;
    });

    if (matchingCategory) {
      purgedCategoryIds.push(matchingCategory.id);
      updatedCategories = updatedCategories.filter((c) => c.id !== matchingCategory.id);
    }

    // Save updated categories and graph
    try {
      saveCategoriesToFS(updatedCategories);
    } catch {}
    try {
      await saveGraphToFSAsync(updatedNodes, updatedEdges, currentGraph.groups || []);
    } catch {}

  } else {
    // Single file deletion
    // 1. Discover matching document
    for (const doc of currentDocs) {
      const { fullRelativePath } = resolveDocumentStoragePath(doc);
      if (
        fullRelativePath === cleanRel ||
        path.basename(fullRelativePath) === path.basename(cleanRel) ||
        (doc.fileUrl && (doc.fileUrl.endsWith(cleanRel) || doc.fileUrl === targetPath))
      ) {
        purgedDocIds.push(doc.id);
      }
    }

    remainingDocs = currentDocs.filter((d) => !purgedDocIds.includes(d.id));

    // 2. Remove physical file from local disk
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch (e) {
      console.warn('[workspaceFS] Local file unlink warning:', e);
    }

    // 3. Remove from Cloud Storage
    if (globalActiveStorageConn && globalActiveFolderPrefix) {
      try {
        await deleteCloudWorkspaceFile(globalActiveStorageConn, globalActiveFolderPrefix, cleanRel);
      } catch (cloudErr) {
        console.warn('[CloudStorage] deleteCloudWorkspaceFile warning:', cloudErr);
      }
    }
  }

  // 4. Save updated documents_index.json to disk and cloud
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remainingDocs, null, 2), 'utf-8');
  } catch {}

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json',
        JSON.stringify(remainingDocs, null, 2),
        'application/json'
      );
    } catch (cloudErr) {
      console.warn('[CloudStorage] documents_index update error:', cloudErr);
    }
  }

  return {
    success: true,
    purgedPath: cleanRel,
    isDirectory,
    purgedDocIds,
    purgedCategoryIds,
    purgedNodeIds,
    message: isDirectory
      ? `DIRECTORY "${cleanRel}" AND CASCADED ASSETS PURGED`
      : `FILE "${cleanRel}" PURGED FROM WORKSPACE`,
  };
}

// ----------------------------------------------------------------------
// CATEGORIES FS HANDLERS
// ----------------------------------------------------------------------

export function loadCategoriesFromFS(): DocCategory[] {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const file = path.join(metaDir, 'categories.json');

  if (!fs.existsSync(file)) return INITIAL_CATEGORIES;

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return INITIAL_CATEGORIES;
  }
}

export async function loadCategoriesFromFSAsync(): Promise<DocCategory[]> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'categories.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/categories.json'
      );
      if (cloudRaw) {
        const cloudCats: DocCategory[] = JSON.parse(cloudRaw);
        if (Array.isArray(cloudCats) && cloudCats.length > 0) {
          try {
            fs.writeFileSync(file, cloudRaw, 'utf-8');
          } catch {}
          return cloudCats;
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadCategoriesFromFSAsync fallback:', e);
    }
  }

  return loadCategoriesFromFS();
}

export async function saveCategoriesToFSAsync(categories: DocCategory[]): Promise<void> {
  saveCategoriesToFS(categories);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/categories.json',
        JSON.stringify(categories, null, 2),
        'application/json'
      );

      for (const cat of categories) {
        const safeCat = getSafeCloudFolderName(cat.title);
        let catRelPath = safeCat;
        if (cat.boardId) {
          try {
            const allNodes = loadGraphFromFS().nodes;
            const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
            if (boardNode) {
              const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
              catRelPath = `${boardFolder}/${safeCat}`;
            }
          } catch {}
        }
        await writeCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          `${catRelPath}/.keep`,
          '',
          'text/plain'
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('[CloudStorage] saveCategoriesToFSAsync error:', err);
    }
  }
}

export function saveCategoriesToFS(categories: DocCategory[]) {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'categories.json');

  let allNodes: GraphNode[] = [];
  try {
    allNodes = loadGraphFromFS().nodes;
  } catch {}

  try {
    fs.writeFileSync(file, JSON.stringify(categories, null, 2), 'utf-8');

    // Ensure category subfolders exist on physical disk
    for (const cat of categories) {
      const safeCat = getSafeCloudFolderName(cat.title);
      let catRelPath = safeCat;
      if (cat.boardId) {
        const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
        if (boardNode) {
          const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
          catRelPath = `${boardFolder}/${safeCat}`;
        }
      }
      const catDir = path.join(vaultPath, catRelPath);
      if (!fs.existsSync(catDir)) {
        try { fs.mkdirSync(catDir, { recursive: true }); } catch {}
      }
    }
  } catch (fsErr) {
    console.warn('[workspaceFS] Local disk categories save bypassed (read-only filesystem):', fsErr);
  }

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/categories.json',
      JSON.stringify(categories, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] saveCategories error:', err));

    for (const cat of categories) {
      const safeCat = getSafeCloudFolderName(cat.title);
      let catRelPath = safeCat;
      if (cat.boardId) {
        const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
        if (boardNode) {
          const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
          catRelPath = `${boardFolder}/${safeCat}`;
        }
      }
      writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        `${catRelPath}/.keep`,
        '',
        'text/plain'
      ).catch(() => {});
    }
  }
}

// ----------------------------------------------------------------------
// GRAPH TOPOLOGY & GROUPS FS HANDLERS
// ----------------------------------------------------------------------

export function syncStickyNoteToDisk(node: GraphNode): GraphNode {
  if (node.type !== 'sticky') return node;

  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const notesDir = path.join(vaultPath, 'notes');

  const safeName = (node.id || 'quick_note')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/\.txt$/i, '');
  
  const fileName = `${safeName}.txt`;
  const filePath = path.join(notesDir, fileName);

  const fileContent = node.content || '';

  try {
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    return {
      ...node,
      txtFilePath: filePath,
    };
  } catch (err) {
    console.warn('[workspaceFS] Sticky note local write bypassed:', err);
    return node;
  }
}

export function loadGraphFromFS(): { nodes: GraphNode[]; edges: GraphEdge[]; groups: GraphGroup[] } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'graph.json');

  const defaultNodes = INITIAL_NODES.map((n) =>
    n.isWorkspaceRoot ? { ...n, workspacePath: vaultPath, title: globalActiveVaultName || n.title } : n
  );

  if (!fs.existsSync(file)) {
    return { nodes: defaultNodes, edges: INITIAL_EDGES, groups: [] };
  }

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    const nodes: GraphNode[] = (data.nodes || defaultNodes).map((n: GraphNode) => {
      let updated = { ...n };
      if (updated.isWorkspaceRoot && globalActiveVaultName) {
        updated.title = globalActiveVaultName;
      }
      if (updated.type === 'sticky' && updated.txtFilePath && fs.existsSync(updated.txtFilePath)) {
        try {
          updated.content = fs.readFileSync(updated.txtFilePath, 'utf-8');
        } catch {
          // Keep existing content
        }
      }
      return updated;
    });
    return { nodes, edges: data.edges || INITIAL_EDGES, groups: data.groups || [] };
  } catch {
    return { nodes: defaultNodes, edges: INITIAL_EDGES, groups: [] };
  }
}

export async function loadGraphFromFSAsync(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
}> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'graph.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/graph.json'
      );
      if (cloudRaw) {
        const cloudData = JSON.parse(cloudRaw);
        if (cloudData && Array.isArray(cloudData.nodes) && cloudData.nodes.length > 0) {
          const mappedNodes = cloudData.nodes.map((n: GraphNode) => {
            if (n.isWorkspaceRoot && globalActiveVaultName) {
              return { ...n, title: globalActiveVaultName, workspacePath: globalActiveVaultPath || n.workspacePath };
            }
            return n;
          });
          try {
            fs.writeFileSync(
              file,
              JSON.stringify({ nodes: mappedNodes, edges: cloudData.edges || [], groups: cloudData.groups || [] }, null, 2),
              'utf-8'
            );
          } catch {}
          return {
            nodes: mappedNodes,
            edges: cloudData.edges || INITIAL_EDGES,
            groups: cloudData.groups || [],
          };
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadGraphFromFSAsync fallback:', e);
    }
  }

  return loadGraphFromFS();
}

export async function saveGraphToFSAsync(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups: GraphGroup[] = []
): Promise<void> {
  saveGraphToFS(nodes, edges, groups);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const syncedNodes = nodes.map((n) => {
      let current = n.type === 'sticky' ? syncStickyNoteToDisk(n) : n;
      if (current.isWorkspaceRoot && globalActiveVaultName) {
        current = { ...current, title: globalActiveVaultName };
      }
      return current;
    });

    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/graph.json',
        JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2),
        'application/json'
      );

      const allCategories = loadCategoriesFromFS();
      for (const n of syncedNodes) {
        if (n.isWorkspaceRoot) continue;
        if (n.type === 'folder' || n.glyph === 'Folder') {
          await syncFolderNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n);
        } else if (n.type === 'collection' || n.glyph === 'Kanban') {
          const boardId = n.collectionId || n.id;
          const boardCols = allCategories.filter((c) => c.boardId === boardId);
          await syncKanbanNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, boardCols);
        }
      }
    } catch (err) {
      console.warn('[CloudStorage] saveGraphToFSAsync error:', err);
    }
  }
}

export function saveGraphToFS(nodes: GraphNode[], edges: GraphEdge[], groups: GraphGroup[] = []) {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const file = path.join(metaDir, 'graph.json');

  // Process sticky nodes to sync physical .txt files and ensure root node title matches active workspace
  const syncedNodes = nodes.map((n) => {
    let current = n.type === 'sticky' ? syncStickyNoteToDisk(n) : n;
    if (current.isWorkspaceRoot && globalActiveVaultName) {
      current = { ...current, title: globalActiveVaultName };
    }
    return current;
  });

  const allCategories = loadCategoriesFromFS();

  try {
    fs.writeFileSync(file, JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2), 'utf-8');

    // Ensure physical directory and README exist on disk for each folder and kanban collection
    const vaultPath = getVaultAbsolutePath();

    for (const n of syncedNodes) {
      if (n.isWorkspaceRoot) continue;
      const safeTitle = getSafeCloudFolderName(n.title);
      if (n.type === 'folder' || n.glyph === 'Folder') {
        const folderDir = path.join(vaultPath, safeTitle);
        if (!fs.existsSync(folderDir)) {
          try { fs.mkdirSync(folderDir, { recursive: true }); } catch {}
        }
        const readmePath = path.join(folderDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          try {
            fs.writeFileSync(readmePath, `# ${n.title}\nFolder created in DocuStack.\n`, 'utf-8');
          } catch {}
        }
      } else if (n.type === 'collection' || n.glyph === 'Kanban') {
        const kanbanDir = path.join(vaultPath, safeTitle);
        if (!fs.existsSync(kanbanDir)) {
          try { fs.mkdirSync(kanbanDir, { recursive: true }); } catch {}
        }
        const boardId = n.collectionId || n.id;
        const boardCols = allCategories.filter((c) => c.boardId === boardId);
        const colsToEnsure = boardCols.length > 0 ? boardCols : [
          { id: 'todo', title: 'To Do' },
          { id: 'progress', title: 'In Progress' },
          { id: 'done', title: 'Done' },
        ];
        for (const col of colsToEnsure) {
          const colFolder = getSafeCloudFolderName(col.title);
          const colDir = path.join(kanbanDir, colFolder);
          if (!fs.existsSync(colDir)) {
            try { fs.mkdirSync(colDir, { recursive: true }); } catch {}
          }
        }
      }
    }
  } catch (fsErr) {
    console.warn('[workspaceFS] Local disk graph save bypassed (read-only or restricted filesystem):', fsErr);
  }

  // Sync to Cloud Storage if active
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/graph.json',
      JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] saveGraphToFS error:', err));

    for (const n of syncedNodes) {
      if (n.isWorkspaceRoot) continue;
      if (n.type === 'folder' || n.glyph === 'Folder') {
        syncFolderNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n)
          .catch((err) => console.warn(`[CloudStorage] syncFolderNode error for ${n.title}:`, err));
      } else if (n.type === 'collection' || n.glyph === 'Kanban') {
        const boardId = n.collectionId || n.id;
        const boardCols = allCategories.filter((c) => c.boardId === boardId);
        syncKanbanNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, boardCols)
          .catch((err) => console.warn(`[CloudStorage] syncKanbanNode error for ${n.title}:`, err));
      }
    }
  }
}

/**
 * Atomic synchronization of entire workspace state (graph, categories, documents, folders, kanbans)
 * to both local disk filesystem and cloud storage (Backblaze B2, R2, S3, Supabase).
 */
export async function syncEntireWorkspaceToDiskAndCloud(data: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups?: GraphGroup[];
  categories: DocCategory[];
  documents: DocumentItem[];
}): Promise<{ success: boolean; cloudSynced: boolean; totalItems: number }> {
  ensureWorkspaceExists();

  // 1. Save Graph
  try {
    saveGraphToFS(data.nodes, data.edges, data.groups || []);
  } catch (err) {
    console.warn('[syncEntireWorkspace] Local saveGraphToFS warning:', err);
  }

  // 2. Save Categories
  try {
    saveCategoriesToFS(data.categories);
  } catch (err) {
    console.warn('[syncEntireWorkspace] Local saveCategoriesToFS warning:', err);
  }

  // 3. Save Documents
  for (const doc of data.documents) {
    try {
      saveDocumentToFS(doc);
    } catch (err) {
      console.warn(`[FS] Error saving doc ${doc.title}:`, err);
    }
  }

  // 4. Cloud Storage Full Sync
  let cloudSynced = false;
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await syncEntireWorkspaceToCloud(globalActiveStorageConn, globalActiveFolderPrefix, {
        nodes: data.nodes,
        edges: data.edges,
        groups: data.groups || [],
        categories: data.categories,
        documents: data.documents,
      });
      cloudSynced = true;
    } catch (cloudErr) {
      console.warn('[CloudStorage] syncEntireWorkspaceToCloud error:', cloudErr);
    }
  }

  return {
    success: true,
    cloudSynced,
    totalItems: data.nodes.length + data.categories.length + data.documents.length,
  };
}

// ----------------------------------------------------------------------
// PHYSICAL FILE SYSTEM TREE INSPECTOR
// ----------------------------------------------------------------------

export interface FileTreeNode {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  sizeBytes?: number;
  sizeFormatted?: string;
  modifiedAt?: string;
  children?: FileTreeNode[];
}

export function getWorkspaceFileTree(): FileTreeNode {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();

  function scanDir(dirPath: string, relPath = ''): FileTreeNode[] {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (entry.name === '.docustack' || entry.name === '.keep') continue; // Hide internal meta directory & keep tokens from tree view

      const fullPath = path.join(dirPath, entry.name);
      const relative = path.join(relPath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          relativePath: relative,
          absolutePath: fullPath,
          isDirectory: true,
          children: scanDir(fullPath, relative),
        });
      } else {
        const stat = fs.statSync(fullPath);
        nodes.push({
          name: entry.name,
          relativePath: relative,
          absolutePath: fullPath,
          isDirectory: false,
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
          modifiedAt: stat.mtime.toISOString().split('T')[0],
        });
      }
    }

    return nodes;
  }

  return {
    name: 'docustack_vault',
    relativePath: 'docustack_vault',
    absolutePath: vaultPath,
    isDirectory: true,
    children: scanDir(vaultPath),
  };
}

// ----------------------------------------------------------------------
// WORKSPACE VAULT WALLPAPER STORAGE HANDLERS
// ----------------------------------------------------------------------

export function getRootVaultWallpaperRelativePath(): string | null {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  if (!fs.existsSync(vaultPath)) return null;

  const entries = fs.readdirSync(vaultPath);
  const wp = entries.find((f) => /^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f));
  return wp || null;
}

export function saveVaultWallpaperFile(
  buffer: Buffer,
  originalFilename: string,
  subDirRelative?: string
): { relativePath: string; url: string } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const ext = path.extname(originalFilename).toLowerCase() || '.png';

  let targetDirectory = vaultPath;
  if (subDirRelative) {
    targetDirectory = path.normalize(path.join(vaultPath, subDirRelative));
    if (!targetDirectory.startsWith(vaultPath)) {
      targetDirectory = vaultPath;
    }
  }

  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  // Purge any existing wallpaper.* file in target directory
  const existingFiles = fs.readdirSync(targetDirectory);
  for (const f of existingFiles) {
    if (/^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f) || f.startsWith('wallpaper.')) {
      try {
        fs.unlinkSync(path.join(targetDirectory, f));
      } catch {}
    }
  }

  const filename = `wallpaper${ext}`;
  const fullPath = path.join(targetDirectory, filename);
  fs.writeFileSync(fullPath, buffer);

  const relativeFromVault = path.relative(vaultPath, fullPath).replace(/\\/g, '/');
  const cacheBuster = Date.now();
  const url = `/api/wallpapers?path=${encodeURIComponent(relativeFromVault)}&t=${cacheBuster}`;

  return { relativePath: relativeFromVault, url };
}

export function deleteVaultWallpaperFile(subDirRelative?: string): boolean {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  let targetDirectory = vaultPath;
  if (subDirRelative) {
    targetDirectory = path.normalize(path.join(vaultPath, subDirRelative));
    if (!targetDirectory.startsWith(vaultPath)) {
      targetDirectory = vaultPath;
    }
  }

  if (fs.existsSync(targetDirectory)) {
    const existingFiles = fs.readdirSync(targetDirectory);
    for (const f of existingFiles) {
      if (/^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f) || f.startsWith('wallpaper.')) {
        try {
          fs.unlinkSync(path.join(targetDirectory, f));
        } catch {}
      }
    }
    return true;
  }
  return false;
}


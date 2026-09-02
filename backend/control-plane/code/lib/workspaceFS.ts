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
  if (!rawPath || rawPath.trim() === '') {
    return path.join(process.cwd(), VAULT_DIR_NAME);
  }
  let clean = rawPath.trim();
  if (clean.startsWith('~')) {
    clean = path.join(os.homedir(), clean.slice(1));
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
  return path.join(process.cwd(), VAULT_DIR_NAME);
}

export function ensureWorkspaceExists(customVaultPath?: string) {
  try {
    const vaultPath = getVaultAbsolutePath(customVaultPath);

    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }

    const subDirs = ['inbox', 'active', 'vault', 'archive', 'engineering'];
    for (const dir of subDirs) {
      const p = path.join(vaultPath, dir);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
    }

    // Create initial workspace meta directory
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

function seedInitialPhysicalDocuments(vaultPath: string) {
  const metaDir = path.join(vaultPath, '.docustack');
  const seededDocs: DocumentItem[] = [];

  const initialFiles = [
    {
      doc: {
        id: 'doc-welcome',
        categoryId: 'cat-inbox',
        title: 'WELCOME_TO_docustack_VAULT.MD',
        description: 'Physical file system workspace guide & setup instructions',
        fileType: 'code' as const,
        fileSize: '4 KB',
        uploadedAt: new Date().toISOString().split('T')[0],
        tags: ['WORKSPACE', 'PHYSICAL_FS', 'VAULT'],
        aiSummary: 'Welcome document saved directly inside the local docustack_vault physical file system.',
      },
      folder: 'inbox',
      fileName: 'welcome_to_docustack_vault.md',
      rawContent: `# docustack PHYSICAL WORKSPACE VAULT
==================================================
This workspace is backed by real file system read/write operations in Node.js.

LOCATION: ${vaultPath}

FEATURES:
- Real-time disk sync for documents, folders, and stacks
- Physical .md / .txt file reading & writing
- D3-force graph layout persistence
- Automatic AI analysis on real local documents

Created automatically at server startup.`,
    },
    {
      doc: INITIAL_DOCUMENTS[0],
      folder: 'vault',
      fileName: 'financial_ledger_q3.txt',
      rawContent: INITIAL_DOCUMENTS[0].content,
    },
    {
      doc: INITIAL_DOCUMENTS[1],
      folder: 'active',
      fileName: 'system_spec_gateway.md',
      rawContent: INITIAL_DOCUMENTS[1].content,
    },
    {
      doc: INITIAL_DOCUMENTS[2],
      folder: 'vault',
      fileName: 'protocol_security_nda.md',
      rawContent: INITIAL_DOCUMENTS[2].content,
    },
    {
      doc: INITIAL_DOCUMENTS[3],
      folder: 'archive',
      fileName: 'telemetry_log_v1.log',
      rawContent: INITIAL_DOCUMENTS[3].content,
    },
  ];

  for (const item of initialFiles) {
    const dir = path.join(vaultPath, item.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, item.fileName);
    const docItem: DocumentItem = {
      ...item.doc,
      content: item.rawContent,
      fileUrl: filePath,
    };

    // Write physical file content to disk
    fs.writeFileSync(filePath, item.rawContent, 'utf-8');
    seededDocs.push(docItem);
  }

  fs.writeFileSync(path.join(metaDir, 'documents_index.json'), JSON.stringify(seededDocs, null, 2), 'utf-8');
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

export function saveDocumentToFS(doc: DocumentItem): DocumentItem {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  const currentDocs = loadDocumentsFromFS();
  const existingIndex = currentDocs.findIndex((d) => d.id === doc.id);

  // Map category to subfolder
  let folderName = 'inbox';
  if (doc.categoryId === 'cat-active') folderName = 'active';
  else if (doc.categoryId === 'cat-vault') folderName = 'vault';
  else if (doc.categoryId === 'cat-archive') folderName = 'archive';
  else if (doc.categoryId.includes('eng')) folderName = 'engineering';

  const folderPath = path.join(vaultPath, folderName);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const safeFileName = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .concat(doc.title.includes('.') ? '' : '.md');

  const physicalPath = doc.fileUrl && fs.existsSync(doc.fileUrl) ? doc.fileUrl : path.join(folderPath, safeFileName);

  // Write content directly to physical disk file
  fs.writeFileSync(physicalPath, doc.content || '# ' + doc.title, 'utf-8');
  const stat = fs.statSync(physicalPath);

  const updatedDoc: DocumentItem = {
    ...doc,
    fileUrl: physicalPath,
    fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
  };

  let updatedDocsList: DocumentItem[];
  if (existingIndex >= 0) {
    updatedDocsList = [...currentDocs];
    updatedDocsList[existingIndex] = updatedDoc;
  } else {
    updatedDocsList = [updatedDoc, ...currentDocs];
  }

  fs.writeFileSync(indexFile, JSON.stringify(updatedDocsList, null, 2), 'utf-8');

  // Sync directly to Cloud Storage (Backblaze B2, R2, S3, Supabase) if active
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const fileContent = doc.content || '# ' + doc.title;
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      `${folderName}/${safeFileName}`,
      fileContent,
      doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
    ).catch((err) => console.warn('[CloudStorage] write file error:', err));

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
  fs.writeFileSync(indexFile, JSON.stringify(remaining, null, 2), 'utf-8');

  // Sync deletion to Cloud Storage if active
  if (globalActiveStorageConn && globalActiveFolderPrefix && target) {
    let folderName = 'inbox';
    if (target.categoryId === 'cat-active') folderName = 'active';
    else if (target.categoryId === 'cat-vault') folderName = 'vault';
    else if (target.categoryId === 'cat-archive') folderName = 'archive';
    else if (target.categoryId.includes('eng')) folderName = 'engineering';

    const safeFileName = target.title
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '_')
      .concat(target.title.includes('.') ? '' : '.md');

    deleteCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      `${folderName}/${safeFileName}`
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
  fs.writeFileSync(catFile, JSON.stringify(remainingCategories, null, 2), 'utf-8');

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
  fs.writeFileSync(indexFile, JSON.stringify(remainingDocs, null, 2), 'utf-8');

  return { purgedDocsCount: docsToDelete.length, purgedCategory: true };
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

export function saveCategoriesToFS(categories: DocCategory[]) {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'categories.json');
  fs.writeFileSync(file, JSON.stringify(categories, null, 2), 'utf-8');

  // Ensure category subfolders exist on physical disk
  for (const cat of categories) {
    const safeCat = getSafeCloudFolderName(cat.title);
    const catDir = path.join(vaultPath, safeCat);
    if (!fs.existsSync(catDir)) {
      try { fs.mkdirSync(catDir, { recursive: true }); } catch {}
    }
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
      writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        `${safeCat}/.keep`,
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
  const inboxDir = path.join(vaultPath, 'inbox');
  if (!fs.existsSync(inboxDir)) fs.mkdirSync(inboxDir, { recursive: true });

  const safeName = (node.id || 'quick_note')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/\.txt$/i, '');
  
  const fileName = `${safeName}.txt`;
  const filePath = path.join(inboxDir, fileName);

  const fileContent = node.content || '';

  try {
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    return {
      ...node,
      txtFilePath: filePath,
    };
  } catch (err) {
    console.error('Error writing sticky note to disk:', err);
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
    const nodes = (data.nodes || defaultNodes).map((n: GraphNode) => {
      const updated = n.isWorkspaceRoot ? { ...n, workspacePath: vaultPath, title: globalActiveVaultName || n.title } : n;
      // Re-read content for sticky notes if file exists
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
      const cols = ['To_Do', 'In_Progress', 'Done'];
      for (const col of cols) {
        const colDir = path.join(kanbanDir, col);
        if (!fs.existsSync(colDir)) {
          try { fs.mkdirSync(colDir, { recursive: true }); } catch {}
        }
      }
    }
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
        syncKanbanNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n)
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
  saveGraphToFS(data.nodes, data.edges, data.groups || []);

  // 2. Save Categories
  saveCategoriesToFS(data.categories);

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
      if (entry.name === '.docustack') continue; // Hide internal meta directory from tree view

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


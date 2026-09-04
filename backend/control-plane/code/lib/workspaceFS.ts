/**
 * ══════════════════════════════════════════════════════════════════════════════
 * WORKSPACE FS BARREL FACADE
 * ══════════════════════════════════════════════════════════════════════════════
 * Modularly partitioned into 4 domain-focused sub-modules:
 * 1. lib/workspace-fs-core.ts: Storage adapters, runtime, and vault paths
 * 2. lib/workspace-fs-documents.ts: Documents CRUD & node asset unlinking
 * 3. lib/workspace-fs-categories.ts: Categories CRUD & cloud sync
 * 4. lib/workspace-fs-graph.ts: Graph topology, full atomic sync, tree & wallpapers
 *
 * 100% backward-compatible with all existing imports across DocuStack & Skipo.
 */

// Core Storage Adapters, Runtime & Vault Paths
export {
  type StorageAdapter,
  LocalStorageAdapter,
  CloudStorageAdapter,
  StorageAdapterFactory,
  SyncEngine,
  WorkspaceFS,
  WorkspaceRuntime,
  sanitizeFolderSegment,
  formatCanonicalWorkspaceFolderName,
  formatCanonicalWorkspacePath,
  globalActiveVaultPath,
  globalActiveVaultName,
  globalActiveStorageConn,
  globalActiveFolderPrefix,
  resolveCustomPath,
  setActiveVaultConfig,
  getActiveVaultName,
  getActiveStorageConn,
  getActiveFolderPrefix,
  getVaultAbsolutePath,
  ensureWorkspaceExists,
} from './workspace-fs-core';

export { resolveNodeNestedPath, getSafeCloudFolderName } from './workspace-canonical';

export {
  LocalFileSystemWorkspaceStorageAdapter,
  ICloudWorkspaceStorageAdapter,
  GoogleDriveWorkspaceStorageAdapter,
  OneDriveWorkspaceStorageAdapter,
  SupabaseWorkspaceStorageAdapter,
  FirebaseWorkspaceStorageAdapter,
  WorkspaceVirtualFileSystemRuntime,
  UserWorkspaceFileStorageCoordinator,
} from './workspace-fs-core';

// Documents FS Handlers
export {
  loadDocumentsFromFS,
  loadDocumentsFromFSAsync,
  resolveDocumentStoragePath,
  saveDocumentToFS,
  saveDocumentToFSAsync,
  deleteDocumentFromFS,
  deleteCategoryAndDocumentsFromFS,
  deleteCategoryAndDocumentsFromFSAsync,
  deleteNodeAssetsAsync,
} from './workspace-fs-documents';

// Categories FS Handlers
export {
  loadCategoriesFromFS,
  loadCategoriesFromFSAsync,
  saveCategoriesToFS,
  saveCategoriesToFSAsync,
} from './workspace-fs-categories';

// Graph Topology, Full Sync, Tree Inspector, Purge & Wallpapers
export {
  loadGraphFromFS,
  loadGraphFromFSAsync,
  saveGraphToFS,
  saveGraphToFSAsync,
  syncStickyNoteToDisk,
  syncEntireWorkspaceToDiskAndCloud,
  getWorkspaceFileTree,
  purgeAssetFromPhysicalWorkspace,
  getRootVaultWallpaperRelativePath,
  saveVaultWallpaperFile,
  deleteVaultWallpaperFile,
} from './workspace-fs-graph';

export type { FileTreeNode, PurgeAssetResult } from './workspace-fs-graph';

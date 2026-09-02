export type BiomeType = 'forest' | 'desert' | 'tundra' | 'ocean' | 'mountain' | 'volcanic';
export type ThemeMode = 'dark' | 'light';

export interface CustomThemeConfig {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  accent: string;
  accentSecondary: string;
  base: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textMuted: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  overlayColor: string;
  overlayOpacity: number; // 0.0 to 1.0
  columnWallpaperOpacity: number; // 0.0 to 1.0 (clarity of wallpaper)
  columnOverlayColor: string; // color of column veil
  columnOverlayOpacity: number; // 0.0 to 1.0 (veil opacity)
}

export interface DocCategory {
  id: string;
  title: string;
  glyph: string;
  color: string;
  description?: string;
  tags?: string[];
  wallpaper?: string;
  isWallpaperManual?: boolean;
  boardId?: string; // Links this stack/column to its specific Kanban board
}

export interface DocumentItem {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  content: string;
  fileType: 'pdf' | 'doc' | 'sheet' | 'image' | 'video' | 'audio' | 'markdown' | 'text' | 'code' | 'other';
  fileSize: string;
  uploadedAt: string;
  tags: string[];
  nlpSummary?: string;
  nlpInsights?: string;
  aiSummary?: string; // Backwards compat alias for legacy stored JSON
  fileUrl?: string;
  accentColor?: string;
}

export interface BiomeOption {
  id: BiomeType;
  glyph: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'nlp' | 'ai';
  text: string;
  timestamp: string;
}

export interface ApiTelemetryEvent {
  id: string;
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
  details?: string;
}

export type NodeType = 'folder' | 'collection' | 'sticky';

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  parentId?: string;
  collectionId?: string; // Links to unique Kanban board ID
  glyph?: string;
  color?: string;
  emoji?: string;
  titleFont?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  tags?: string[];
  content?: string;
  description?: string;
  txtFilePath?: string;
  isWorkspaceRoot?: boolean;
  workspacePath?: string;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphGroup {
  id: string;
  title: string;
  nodeIds: string[];
  color?: string;
  wallpaper?: string;
  titleFont?: string;
  fontSize?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edgeType: 'subfolder' | 'collection';
}

export interface KanbanBoardData {
  id: string;
  title: string;
  categories: DocCategory[];
  color?: string;
}

export interface StackCollection {
  id: string;
  title: string;
  categories: DocCategory[];
  documents: DocumentItem[];
}

export type DatabaseEngine =
  | 'local_fs'
  | 'icloud'
  | 'google_drive'
  | 'onedrive'
  | 's3_blob'
  | 'firebase';

export type WorkspaceStorageEngine = DatabaseEngine;

export interface LocalFsConfig {
  vaultPath: string;
  autoScanSubfolders: boolean;
  maxFileSizeMb: number;
}

export interface ICloudConfig {
  containerId: string;
  syncIntervalMinutes: number;
}

export interface GoogleDriveAccountRecord {
  id: string;
  accountEmail: string;
  accountName?: string;
  rootFolderId: string;
  targetFolderPath?: string;
  authStatus?: 'authorized' | 'connected' | 'unauthorized' | 'expired' | 'pending';
  lastSyncedAt?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  storageQuota?: {
    usageBytes: number;
    limitBytes: number;
    usageFormatted: string;
    limitFormatted: string;
  };
}

export interface GoogleDriveConfig {
  rootFolderId: string;
  accountEmail?: string;
  syncOnSave: boolean;
  activeAccountId?: string;
  accounts?: GoogleDriveAccountRecord[];
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface OneDriveConfig {
  rootFolderId: string;
  accountEmail?: string;
  syncOnSave: boolean;
}

export interface S3BlobConfig {
  provider: 's3' | 'vercel_blob' | 'cloudflare_r2';
  bucketName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpointUrl?: string;
  blobToken?: string;
}

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  clientEmail?: string;
  privateKey?: string;
  databaseId?: string;
  storageBucket?: string;
}

export interface DatabaseSettings {
  engine: DatabaseEngine;
  activeProfileName: string;
  autoSync: boolean;
  local_fs: LocalFsConfig;
  icloud?: ICloudConfig;
  google_drive?: GoogleDriveConfig;
  onedrive?: OneDriveConfig;
  s3_blob?: S3BlobConfig;
  firebase?: FirebaseConfig;
  lastConnectedAt?: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastError?: string;
}

export interface WorkspaceTile {
  id: string;
  width: number;
  height: number;
  activeDocId: string | 'browser';
  customTitle?: string;
}

export interface WorkspaceTab {
  id: string;
  name: string;
  tiles: WorkspaceTile[];
  createdAt: number;
}

export type AssetType = 'document' | 'kanban' | 'folder' | 'subfolder' | 'group' | 'sticky';

export interface SearchAssetResult {
  id: string;
  assetType: AssetType;
  title: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
  color?: string;
  glyph?: string;
  itemRef?: any;
}

export type UserRole = 'admin' | 'pro' | 'user';

export interface UserWorkspaceRecord {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  engine: DatabaseEngine;
  workspacePath: string;
  storageSettings?: Partial<DatabaseSettings>;
  storageConnectionId?: string;
  storageProvider?: UserStorageProvider;
  localFolderName?: string;
  localFolderKey?: string;
  isDefault?: boolean;
  docCount?: number;
  lastOpenedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Universal Ultrst Identity Interface
 * Shared across ALL applications in the Ultrst Ecosystem.
 */
export interface UltrstIdentity {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  avatarGlyph?: string;
  createdAt: string;
  lastLoginAt?: string;
  updatedAt?: string;
  passwordHash?: string;
  /**
   * Namespaced profile objects for each app in the ecosystem.
   * e.g. { docustack: DocuStackAppProfile, "ultrst-notes": { ... }, "ultrst-music": { ... } }
   */
  appProfiles?: Record<string, Record<string, any>>;
}

export type UserStorageProvider =
  | 'local_fs'
  | 'backblaze_b2'
  | 'cloudflare_r2'
  | 'supabase_storage'
  | 'aws_s3';

/**
 * User-Scoped Storage Connection Record
 * Stores user-owned cloud storage credentials (Backblaze B2, Cloudflare R2, AWS S3, Supabase)
 * or local folder handle descriptors in the user profile in the system database.
 */
export interface UserStorageConnection {
  id: string;
  provider: UserStorageProvider;
  label: string;
  createdAt: string;
  updatedAt?: string;
  testedAt?: string;
  testStatus?: 'ok' | 'failed';
  testError?: string;
  latencyMs?: number;

  // Backblaze B2 (S3-compatible)
  b2KeyId?: string;
  b2ApplicationKey?: string;
  b2BucketName?: string;
  b2Region?: string;
  b2Endpoint?: string;

  // Cloudflare R2 (S3-compatible)
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;

  // AWS S3
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3BucketName?: string;
  s3Region?: string;
  s3Endpoint?: string;

  // Supabase Storage
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  supabaseBucketName?: string;

  // Local FS Browser Handle reference metadata
  localFolderKey?: string;
  localFolderName?: string;
  localFolderPathHint?: string;
}

/**
 * Universal Ultrst Storage Config Document
 * Standardized across all Ultrst ecosystem applications for importing/exporting
 * user-owned workspace storage configurations as portable JSON documents.
 */
export interface UltrstStorageExport {
  $schema?: string;
  version: 1;
  ecosystem: 'ultrst';
  exportedAt: string;
  appName?: string;
  storage: UserStorageConnection;
}

export interface UltrstStorageBundleExport {
  $schema?: string;
  version: 1;
  ecosystem: 'ultrst';
  exportedAt: string;
  appName?: string;
  connections: UserStorageConnection[];
}

/**
 * DocuStack App-Specific Profile Object stored inside appProfiles['docustack']
 */
export interface DocuStackAppProfile {
  workspacePath?: string;
  workspaceName?: string;
  activeWorkspaceId?: string;
  workspaces?: UserWorkspaceRecord[];
  themePreference?: string;
  registeredAt?: string;
  lastActiveAt?: string;
  /**
   * User-scoped storage connections (Backblaze B2, Cloudflare R2, AWS S3, Supabase Storage, etc.)
   * Persisted directly to user profile in system database.
   */
  storage_connections?: UserStorageConnection[];
}

/**
 * UserAccount representing a user session and profile inside DocuStack Engine.
 * Backwards compatible with legacy callers while exposing the universal appProfiles map.
 */
export interface UserAccount extends UltrstIdentity {
  // Direct accessors for DocuStack-specific workspace profile (mapped to appProfiles['docustack'])
  workspacePath?: string;
  workspaceName?: string;
  activeWorkspaceId?: string;
  workspaces?: UserWorkspaceRecord[];
  storage_connections?: UserStorageConnection[];
}

export interface UserSession {
  user: Omit<UserAccount, 'passwordHash'>;
  token: string;
  expiresAt: number;
}

export interface MediaItem {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  fileSize: number; // In bytes
  fileSizeFormatted: string; // e.g. "2.4 MB"
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'other';
  url: string;
  uploadedAt: string;
  dimensions?: { width: number; height: number };
  tags: string[];
  description?: string;
}


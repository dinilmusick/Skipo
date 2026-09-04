export type StorageMode = 'local' | 'local_hosted' | 'remote';
export type StorageProviderType = 'local_fs' | 's3' | 'supabase' | 'firebase' | 'google_drive';

export interface StorageConfig {
  provider: StorageProviderType;
  mode: StorageMode;
  basePath?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface FileInfo {
  path: string;
  size: number;
  modifiedAt: number;
  contentHash?: string;
}

export interface UploadResult {
  path: string;
  size: number;
  url?: string;
}

import { SkipoBase } from '@skipo/core';

type StorageMode = 'local' | 'local_hosted' | 'remote';
type StorageProviderType = 'local_fs' | 's3' | 'backblaze_b2' | 'b2' | 'cloudflare_r2' | 'r2' | 'supabase' | 'firebase' | 'google_drive';
interface StorageConfig {
    provider: StorageProviderType;
    mode?: StorageMode;
    basePath?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
    b2KeyId?: string;
    b2ApplicationKey?: string;
    b2BucketName?: string;
    b2Endpoint?: string;
    b2Region?: string;
    keyId?: string;
    applicationKey?: string;
    accountId?: string;
}
interface FileInfo {
    path: string;
    size: number;
    modifiedAt: number;
    contentHash?: string;
}
interface UploadResult {
    path: string;
    size: number;
    url?: string;
}
interface DeleteFolderResult {
    success: boolean;
    deletedCount: number;
}
interface RenameFolderResult {
    success: boolean;
    movedCount: number;
}
interface ConnectionTestResult {
    ok: boolean;
    latencyMs: number;
    error?: string;
    details?: Record<string, any>;
}

declare abstract class BaseStorageAdapter extends SkipoBase {
    protected config: StorageConfig;
    constructor(config: StorageConfig);
    abstract read(pathStr: string): Promise<Uint8Array>;
    abstract write(pathStr: string, data: Uint8Array | string, contentType?: string): Promise<void>;
    abstract delete(pathStr: string): Promise<void>;
    abstract exists(pathStr: string): Promise<boolean>;
    abstract list(pathStr?: string): Promise<FileInfo[]>;
    abstract stat(pathStr: string): Promise<FileInfo>;
    abstract mkdir(pathStr: string): Promise<void>;
    deleteFolder(pathStr: string): Promise<DeleteFolderResult>;
    renameFolder(oldPath: string, newPath: string): Promise<RenameFolderResult>;
    ensureDirectory(pathStr: string): Promise<void>;
    testConnection(): Promise<ConnectionTestResult>;
    protected normalizePath(p: string): string;
    protected getExtension(p: string): string;
}

declare class LocalFSAdapter extends BaseStorageAdapter {
    private basePath;
    constructor(config: StorageConfig);
    private resolvePath;
    read(pathStr: string): Promise<Uint8Array>;
    write(pathStr: string, data: Uint8Array | string): Promise<void>;
    delete(pathStr: string): Promise<void>;
    exists(pathStr: string): Promise<boolean>;
    list(pathStr?: string): Promise<FileInfo[]>;
    stat(pathStr: string): Promise<FileInfo>;
    mkdir(pathStr: string): Promise<void>;
    deleteFolder(pathStr: string): Promise<{
        success: boolean;
        deletedCount: number;
    }>;
    renameFolder(oldPath: string, newPath: string): Promise<{
        success: boolean;
        movedCount: number;
    }>;
}

declare class S3Adapter extends BaseStorageAdapter {
    private client;
    private bucket;
    constructor(config: StorageConfig);
    private ensureClient;
    read(pathStr: string): Promise<Uint8Array>;
    write(pathStr: string, data: Uint8Array | string, contentType?: string): Promise<void>;
    delete(pathStr: string): Promise<void>;
    deleteFolder(pathStr: string): Promise<DeleteFolderResult>;
    renameFolder(oldPath: string, newPath: string): Promise<RenameFolderResult>;
    ensureDirectory(pathStr: string): Promise<void>;
    exists(pathStr: string): Promise<boolean>;
    list(pathStr?: string): Promise<FileInfo[]>;
    stat(pathStr: string): Promise<FileInfo>;
    mkdir(pathStr: string): Promise<void>;
    testConnection(): Promise<ConnectionTestResult>;
}

declare class BackblazeB2Adapter extends BaseStorageAdapter {
    private client;
    private bucket;
    constructor(config: StorageConfig);
    private ensureClient;
    read(pathStr: string): Promise<Uint8Array>;
    write(pathStr: string, data: Uint8Array | string, contentType?: string): Promise<void>;
    delete(pathStr: string): Promise<void>;
    deleteFolder(pathStr: string): Promise<DeleteFolderResult>;
    renameFolder(oldPath: string, newPath: string): Promise<RenameFolderResult>;
    ensureDirectory(pathStr: string): Promise<void>;
    exists(pathStr: string): Promise<boolean>;
    list(pathStr?: string): Promise<FileInfo[]>;
    stat(pathStr: string): Promise<FileInfo>;
    mkdir(pathStr: string): Promise<void>;
    testConnection(): Promise<ConnectionTestResult>;
}

/**
 * Backblaze B2 Endpoint & Credential Normalizer
 */
declare function isSecretMasked(str?: string): boolean;
declare function resolveBackblazeEndpoint(inputEndpointOrRegion?: string, keyId?: string): {
    endpoint: string;
    region: string;
};
declare function normalizeBackblazeCredentials(inputKeyId?: string, inputAppKey?: string): {
    keyId: string;
    appKey: string;
};

/**
 * S3 & Backblaze B2 Zero-Asterisk Permanent Purge & Folder Engine
 */
declare function ensureS3DirectoryMarker(s3: any, bucketName: string, folderPrefix: string): Promise<void>;
declare function permanentDeleteS3Object(s3: any, bucketName: string, fullKey: string): Promise<boolean>;
declare function permanentDeleteS3Folder(s3: any, bucketName: string, targetPrefix: string): Promise<{
    success: boolean;
    deletedCount: number;
}>;
declare function renameS3Folder(s3: any, bucketName: string, oldPrefix: string, newPrefix: string): Promise<{
    success: boolean;
    movedCount: number;
}>;

declare class SupabaseStorageAdapter extends BaseStorageAdapter {
    private client;
    private bucket;
    constructor(config: StorageConfig);
    private ensureClient;
    read(pathStr: string): Promise<Uint8Array>;
    write(pathStr: string, data: Uint8Array | string): Promise<void>;
    delete(pathStr: string): Promise<void>;
    exists(pathStr: string): Promise<boolean>;
    list(pathStr?: string): Promise<FileInfo[]>;
    stat(pathStr: string): Promise<FileInfo>;
    mkdir(_pathStr: string): Promise<void>;
}

declare class StorageAdapterFactory {
    static create(config: StorageConfig): BaseStorageAdapter;
}

export { BackblazeB2Adapter, BaseStorageAdapter, type ConnectionTestResult, type DeleteFolderResult, type FileInfo, LocalFSAdapter, type RenameFolderResult, S3Adapter, StorageAdapterFactory, type StorageConfig, type StorageMode, type StorageProviderType, SupabaseStorageAdapter, type UploadResult, ensureS3DirectoryMarker, isSecretMasked, normalizeBackblazeCredentials, permanentDeleteS3Folder, permanentDeleteS3Object, renameS3Folder, resolveBackblazeEndpoint };

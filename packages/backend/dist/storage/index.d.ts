import { SkipoBase } from '@skipo/core';

type StorageMode = 'local' | 'local_hosted' | 'remote';
type StorageProviderType = 'local_fs' | 's3' | 'supabase' | 'firebase' | 'google_drive';
interface StorageConfig {
    provider: StorageProviderType;
    mode: StorageMode;
    basePath?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
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

declare abstract class BaseStorageAdapter extends SkipoBase {
    protected config: StorageConfig;
    constructor(config: StorageConfig);
    abstract read(pathStr: string): Promise<Uint8Array>;
    abstract write(pathStr: string, data: Uint8Array | string): Promise<void>;
    abstract delete(pathStr: string): Promise<void>;
    abstract exists(pathStr: string): Promise<boolean>;
    abstract list(pathStr?: string): Promise<FileInfo[]>;
    abstract stat(pathStr: string): Promise<FileInfo>;
    abstract mkdir(pathStr: string): Promise<void>;
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
}

declare class S3Adapter extends BaseStorageAdapter {
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

export { BaseStorageAdapter, type FileInfo, LocalFSAdapter, S3Adapter, StorageAdapterFactory, type StorageConfig, type StorageMode, type StorageProviderType, SupabaseStorageAdapter, type UploadResult };

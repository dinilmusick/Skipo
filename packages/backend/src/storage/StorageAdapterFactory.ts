import { BaseStorageAdapter } from './BaseStorageAdapter.js';
import { StorageConfig } from './types.js';
import { LocalFSAdapter } from './LocalFSAdapter.js';
import { S3Adapter } from './S3Adapter.js';
import { SupabaseStorageAdapter } from './SupabaseStorageAdapter.js';

export class StorageAdapterFactory {
  static create(config: StorageConfig): BaseStorageAdapter {
    switch (config.provider) {
      case 'local_fs':
        return new LocalFSAdapter(config);
      case 's3':
        return new S3Adapter(config);
      case 'supabase':
        return new SupabaseStorageAdapter(config);
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }
}

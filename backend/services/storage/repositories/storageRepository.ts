/**
 * @file storageRepository.ts
 * @description Storage Metadata Persistence Boundary.
 * Conforms to APP_ARCHITECTURE_SPEC Section 20 & < 200 lines.
 */

export interface StorageFileRecord {
  key: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
  etag?: string;
}

export class StorageRepository {
  private files: Map<string, StorageFileRecord> = new Map();

  public async recordMetadata(record: StorageFileRecord): Promise<void> {
    this.files.set(record.key, record);
  }

  public async getMetadata(key: string): Promise<StorageFileRecord | null> {
    return this.files.get(key) || null;
  }

  public async listFiles(): Promise<StorageFileRecord[]> {
    return Array.from(this.files.values());
  }

  public async deleteMetadata(key: string): Promise<boolean> {
    return this.files.delete(key);
  }
}

export const storageRepository = new StorageRepository();

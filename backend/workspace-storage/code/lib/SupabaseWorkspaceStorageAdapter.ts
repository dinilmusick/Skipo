// ══════════════════════════════════════════════════════════════════════════════════════════
// SUPABASE / S3 WORKSPACE STORAGE ADAPTER (VIRTUAL OBJECT STORAGE FILESYSTEM)
// ══════════════════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { WorkspaceStorageAdapter } from './LocalFileSystemWorkspaceStorageAdapter';
import { StorageEngineType } from './control-plane-types';

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: SupabaseWorkspaceStorageAdapter
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Implements a virtual Supabase Storage / AWS S3 / Cloudflare R2 bucket storage adapter
 * mapping flat bucket object keys to a full virtual POSIX workspace filesystem hierarchy.
 *
 * Bucket Path:
 *   supabase://storage/v1/object/docustack-vault/[relativePath]
 *
 * Flow Architecture:
 * ┌───────────────────────────────────────┐
 * │ WorkspaceFS File Operation            │
 * └───────────────────┬───────────────────┘
 *                     │
 *                     ▼
 * ┌───────────────────────────────────────┐
 * │ S3/Supabase Object Key Mapping        │
 * └───────────────────┬───────────────────┘
 *                     │
 *                     ▼
 * ┌───────────────────────────────────────┐
 * │ PutObject / GetObject Binary Stream   │
 * └───────────────────────────────────────┘
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

interface ObjectStoreEntry {
  data: Uint8Array;
  mtime: number;
  size: number;
  hash: string;
}

export class SupabaseWorkspaceStorageAdapter implements WorkspaceStorageAdapter {
  public id: string;
  public provider: StorageEngineType = 'supabase_storage';
  public bucket: string;
  public projectUrl?: string;
  public token?: string;
  private virtualStorage = new Map<string, ObjectStoreEntry>();

  constructor(
    id: string = 'ep_supabase_storage',
    bucket: string = 'docustack_vault',
    projectUrl?: string,
    token?: string
  ) {
    this.id = id;
    this.bucket = bucket;
    this.projectUrl = projectUrl;
    this.token = token;
  }

  private normalizeKey(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    const key = this.normalizeKey(relativePath);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');

    this.virtualStorage.set(key, {
      data: bytes,
      mtime: Date.now(),
      size: bytes.length,
      hash,
    });
  }

  async read(relativePath: string): Promise<Uint8Array> {
    const key = this.normalizeKey(relativePath);
    const entry = this.virtualStorage.get(key);
    if (!entry) {
      throw new Error(`SUPABASE_STORAGE_FILE_NOT_FOUND: [${this.bucket}] ${key}`);
    }
    return entry.data;
  }

  async readText(relativePath: string): Promise<string> {
    const bytes = await this.read(relativePath);
    return new TextDecoder().decode(bytes);
  }

  async delete(relativePath: string): Promise<boolean> {
    const key = this.normalizeKey(relativePath);
    return this.virtualStorage.delete(key);
  }

  async exists(relativePath: string): Promise<boolean> {
    const key = this.normalizeKey(relativePath);
    return this.virtualStorage.has(key);
  }

  async stat(relativePath: string): Promise<{ size: number; mtime: number; isDirectory: boolean }> {
    const key = this.normalizeKey(relativePath);
    const entry = this.virtualStorage.get(key);
    if (!entry) {
      const prefix = key.endsWith('/') ? key : `${key}/`;
      const isDir = Array.from(this.virtualStorage.keys()).some((k) => k.startsWith(prefix));
      if (isDir) {
        return { size: 0, mtime: Date.now(), isDirectory: true };
      }
      throw new Error(`SUPABASE_STORAGE_FILE_NOT_FOUND: [${this.bucket}] ${key}`);
    }
    return {
      size: entry.size,
      mtime: entry.mtime,
      isDirectory: false,
    };
  }

  async mkdir(_dirPath: string): Promise<void> {}

  async list(dirPath: string = ''): Promise<string[]> {
    const normDir = this.normalizeKey(dirPath);
    const prefix = normDir ? (normDir.endsWith('/') ? normDir : `${normDir}/`) : '';
    const keys = Array.from(this.virtualStorage.keys());

    if (!prefix) return keys;
    return keys
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  async getHash(relativePath: string): Promise<string> {
    const key = this.normalizeKey(relativePath);
    const entry = this.virtualStorage.get(key);
    if (!entry) {
      throw new Error(`SUPABASE_STORAGE_FILE_NOT_FOUND: [${this.bucket}] ${key}`);
    }
    return entry.hash;
  }
}

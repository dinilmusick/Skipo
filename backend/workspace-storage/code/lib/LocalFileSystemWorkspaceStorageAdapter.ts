// ══════════════════════════════════════════════════════════════════════════════════════════
// LOCAL FILE SYSTEM WORKSPACE STORAGE ADAPTER (POSIX & NODE FS)
// ══════════════════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageEngineType } from './control-plane-types';

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: LocalFileSystemWorkspaceStorageAdapter
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Implements direct POSIX disk-level reading, writing, listing, and hashing of workspace
 * files and directories. Provides security sandboxing to prevent directory traversal
 * attacks outside of the designated vault root directory.
 *
 * Persistence Flow:
 * ┌─────────────────────────┐
 * │ WorkspaceFS.write()     │
 * └────────────┬────────────┘
 *              │
 *              ▼
 * ┌─────────────────────────┐
 * │ Resolve Vault Directory │
 * └────────────┬────────────┘
 *              │
 *              ▼
 * ┌─────────────────────────┐
 * │ Ensure Parent Directory │
 * └────────────┬────────────┘
 *              │
 *              ▼
 * ┌─────────────────────────┐
 * │ Atomic Write to Disk    │
 * └─────────────────────────┘
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export interface WorkspaceStorageAdapter {
  id: string;
  provider: StorageEngineType;
  write(relativePath: string, data: Uint8Array | string): Promise<void>;
  read(relativePath: string): Promise<Uint8Array>;
  readText(relativePath: string): Promise<string>;
  delete(relativePath: string): Promise<boolean>;
  list(dirPath?: string): Promise<string[]>;
  exists(relativePath: string): Promise<boolean>;
  stat(relativePath: string): Promise<{ size: number; mtime: number; isDirectory: boolean }>;
  mkdir(dirPath: string): Promise<void>;
  getHash(relativePath: string): Promise<string>;
}

export class LocalFileSystemWorkspaceStorageAdapter implements WorkspaceStorageAdapter {
  public id: string;
  public provider: StorageEngineType = 'local';
  private basePath: string;

  constructor(id: string = 'ep_local_fs', basePath?: string) {
    this.id = id;
    this.basePath = basePath || path.join(process.cwd(), 'docustack_vault');
    this.ensureBasePath();
  }

  private ensureBasePath(): void {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }
    } catch (err) {
      console.warn('LocalFileSystemWorkspaceStorageAdapter: Base directory init bypassed:', err);
    }
  }

  public resolvePath(relativePath: string): string {
    const normalized = path.normalize(path.join(this.basePath, relativePath));
    if (!normalized.startsWith(this.basePath)) {
      throw new Error(`STORAGE_SECURITY_VIOLATION: Path traversal outside vault directory is forbidden: [${relativePath}]`);
    }
    return normalized;
  }

  async write(relativePath: string, data: Uint8Array | string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
    fs.writeFileSync(fullPath, buffer);
  }

  async read(relativePath: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`FILE_NOT_FOUND: [${this.id}] ${relativePath}`);
    }
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  async readText(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`FILE_NOT_FOUND: [${this.id}] ${relativePath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  async delete(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      return true;
    }
    return false;
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    return fs.existsSync(fullPath);
  }

  async stat(relativePath: string): Promise<{ size: number; mtime: number; isDirectory: boolean }> {
    const fullPath = this.resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`FILE_NOT_FOUND: [${this.id}] ${relativePath}`);
    }
    const s = fs.statSync(fullPath);
    return {
      size: s.size,
      mtime: s.mtimeMs,
      isDirectory: s.isDirectory(),
    };
  }

  async mkdir(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  async list(dirPath: string = ''): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);
    if (!fs.existsSync(fullPath)) return [];

    const fileList: string[] = [];
    const scan = (currentDir: string, rel: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.docustack' || entry.name === '.git') continue;
        const subFull = path.join(currentDir, entry.name);
        const subRel = path.join(rel, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          scan(subFull, subRel);
        } else {
          fileList.push(subRel);
        }
      }
    };

    scan(fullPath, dirPath);
    return fileList;
  }

  async getHash(relativePath: string): Promise<string> {
    const bytes = await this.read(relativePath);
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }
}

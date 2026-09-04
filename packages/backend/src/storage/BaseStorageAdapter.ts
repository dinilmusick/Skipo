import { SkipoBase } from '@skipo/core';
import { FileInfo, StorageConfig } from './types.js';

export abstract class BaseStorageAdapter extends SkipoBase {
  protected config: StorageConfig;

  constructor(config: StorageConfig) {
    super();
    this.config = config;
  }

  abstract read(pathStr: string): Promise<Uint8Array>;
  abstract write(pathStr: string, data: Uint8Array | string): Promise<void>;
  abstract delete(pathStr: string): Promise<void>;
  abstract exists(pathStr: string): Promise<boolean>;
  abstract list(pathStr?: string): Promise<FileInfo[]>;
  abstract stat(pathStr: string): Promise<FileInfo>;
  abstract mkdir(pathStr: string): Promise<void>;

  protected normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  protected getExtension(p: string): string {
    const parts = p.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }
}

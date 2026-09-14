/**
 * @file storage.ts
 * @description Cloud & File Storage Service Facade.
 * Conforms to APP_ARCHITECTURE_SPEC Sections 5 & 6.
 */

import type { Runtime, Deployment } from '@skipo/backend';
import { storageEngine } from './server/storageEngine';
import { remoteStorageClient } from './remote/remoteStorageClient';

export const runtime: Runtime = 'server';
export const deployment: Deployment = 'local';

export const service = {
  name: 'storage',
  runtime,
  deployment,
  getUploadPresignedUrl: async (key: string, contentType?: string) => {
    if (deployment === 'local') {
      return storageEngine.createUploadUrl(key, contentType);
    }
    return remoteStorageClient.getUploadUrl(key, contentType);
  },
  getDownloadPresignedUrl: async (key: string) => {
    if (deployment === 'local') {
      return storageEngine.createDownloadUrl(key);
    }
    return remoteStorageClient.getDownloadUrl(key);
  },
  deleteFile: async (key: string) => {
    if (deployment === 'local') {
      return storageEngine.deleteFile(key);
    }
    return remoteStorageClient.deleteFile(key);
  },
};

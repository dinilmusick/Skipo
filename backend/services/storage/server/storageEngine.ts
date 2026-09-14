/**
 * @file storageEngine.ts
 * @description Local Server Storage Engine handling S3 / B2 Presigned URL Generation.
 * Conforms to < 200 lines limit.
 */

import { storageRepository } from '../repositories/storageRepository';

export class StorageEngine {
  public async createUploadUrl(key: string, contentType: string = 'application/octet-stream') {
    // In production, instantiate S3Client / GetSignedUrl from @aws-sdk/s3-request-presigner
    const presignedUrl = `https://storage.local/${encodeURIComponent(key)}?upload=true&sig=${Date.now()}`;
    await storageRepository.recordMetadata({
      key,
      contentType,
      sizeBytes: 0,
      createdAt: Date.now(),
    });
    return { presignedUrl, key };
  }

  public async createDownloadUrl(key: string) {
    const meta = await storageRepository.getMetadata(key);
    if (!meta) throw new Error(`File not found: ${key}`);
    const presignedUrl = `https://storage.local/${encodeURIComponent(key)}?download=true&sig=${Date.now()}`;
    return { presignedUrl, metadata: meta };
  }

  public async deleteFile(key: string) {
    await storageRepository.deleteMetadata(key);
    return true;
  }
}

export const storageEngine = new StorageEngine();

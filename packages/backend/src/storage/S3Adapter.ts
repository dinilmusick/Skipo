import { BaseStorageAdapter } from './BaseStorageAdapter.js';
import { FileInfo, StorageConfig } from './types.js';

let S3Client: any, PutObjectCommand: any, GetObjectCommand: any, DeleteObjectCommand: any, ListObjectsV2Command: any, HeadObjectCommand: any, ListObjectVersionsCommand: any, DeleteObjectsCommand: any;

export class S3Adapter extends BaseStorageAdapter {
  private client: any;
  private bucket: string;

  constructor(config: StorageConfig) {
    super(config);
    this.bucket = config.bucket || '';
  }

  private async ensureClient() {
    if (this.client) return;
    try {
      const aws = await import('@aws-sdk/client-s3');
      S3Client = aws.S3Client;
      PutObjectCommand = aws.PutObjectCommand;
      GetObjectCommand = aws.GetObjectCommand;
      DeleteObjectCommand = aws.DeleteObjectCommand;
      ListObjectsV2Command = aws.ListObjectsV2Command;
      HeadObjectCommand = aws.HeadObjectCommand;
      ListObjectVersionsCommand = aws.ListObjectVersionsCommand;
      DeleteObjectsCommand = aws.DeleteObjectsCommand;

      this.client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKey!,
          secretAccessKey: this.config.secretKey!
        },
        forcePathStyle: true // Needed for B2/R2 often
      });
    } catch (e) {
      throw new Error('@aws-sdk/client-s3 is not installed or failed to initialize.');
    }
  }

  async read(pathStr: string): Promise<Uint8Array> {
    await this.ensureClient();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    return byteArray;
  }

  async write(pathStr: string, data: Uint8Array | string): Promise<void> {
    await this.ensureClient();
    const command = new PutObjectCommand({ 
      Bucket: this.bucket, 
      Key: this.normalizePath(pathStr),
      Body: data
    });
    await this.client.send(command);
  }

  async delete(pathStr: string): Promise<void> {
    await this.ensureClient();
    const key = this.normalizePath(pathStr);
    
    // Zero-asterisk B2 deletion: purge all versions
    const versionsCmd = new ListObjectVersionsCommand({ Bucket: this.bucket, Prefix: key });
    const versionsRes = await this.client.send(versionsCmd);
    
    const objectsToDelete: any[] = [];
    if (versionsRes.Versions) {
      objectsToDelete.push(...versionsRes.Versions.map((v: any) => ({ Key: v.Key, VersionId: v.VersionId })));
    }
    if (versionsRes.DeleteMarkers) {
      objectsToDelete.push(...versionsRes.DeleteMarkers.map((v: any) => ({ Key: v.Key, VersionId: v.VersionId })));
    }
    
    if (objectsToDelete.length > 0) {
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objectsToDelete }
      });
      await this.client.send(deleteCmd);
    } else {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(command);
    }
  }

  async exists(pathStr: string): Promise<boolean> {
    await this.ensureClient();
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
      await this.client.send(command);
      return true;
    } catch (e: any) {
      if (e.name === 'NotFound') return false;
      throw e;
    }
  }

  async list(pathStr = ''): Promise<FileInfo[]> {
    await this.ensureClient();
    const command = new ListObjectsV2Command({ 
      Bucket: this.bucket, 
      Prefix: pathStr ? this.normalizePath(pathStr) + '/' : '' 
    });
    const response = await this.client.send(command);
    
    return (response.Contents || []).map((item: any) => ({
      path: item.Key!,
      size: item.Size || 0,
      modifiedAt: item.LastModified ? item.LastModified.getTime() : 0
    }));
  }

  async stat(pathStr: string): Promise<FileInfo> {
    await this.ensureClient();
    const command = new HeadObjectCommand({ Bucket: this.bucket, Key: this.normalizePath(pathStr) });
    const response = await this.client.send(command);
    return {
      path: pathStr,
      size: response.ContentLength || 0,
      modifiedAt: response.LastModified ? response.LastModified.getTime() : 0
    };
  }

  async mkdir(pathStr: string): Promise<void> {
    // S3 has flat hierarchy, no explicit mkdir needed
  }
}

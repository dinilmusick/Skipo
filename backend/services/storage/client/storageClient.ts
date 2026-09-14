/**
 * @file storageClient.ts
 * @description Direct presigned upload & download client for browser execution.
 * Conforms to < 200 lines limit.
 */

export class StorageClient {
  public async uploadDirect(presignedUrl: string, file: File | Blob): Promise<boolean> {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    return res.ok;
  }

  public async downloadDirect(presignedUrl: string): Promise<Blob> {
    const res = await fetch(presignedUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    return res.blob();
  }
}

export const storageClient = new StorageClient();

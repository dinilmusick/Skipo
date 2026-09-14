/**
 * @file remoteStorageClient.ts
 * @description Remote Storage Client dispatching requests through Gateway.
 * Conforms to < 200 lines limit.
 */

export class RemoteStorageClient {
  public async getUploadUrl(key: string, contentType?: string) {
    const res = await fetch('/api/storage/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, contentType }),
    });
    if (!res.ok) throw new Error(`Failed to obtain remote upload URL: ${res.statusText}`);
    return res.json();
  }

  public async getDownloadUrl(key: string) {
    const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`Failed to obtain remote download URL: ${res.statusText}`);
    return res.json();
  }

  public async deleteFile(key: string) {
    const res = await fetch('/api/storage/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return res.ok;
  }
}

export const remoteStorageClient = new RemoteStorageClient();

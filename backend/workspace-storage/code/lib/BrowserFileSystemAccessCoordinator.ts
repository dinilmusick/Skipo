// ══════════════════════════════════════════════════════════════════════════════════════════
// BROWSER LOCAL FILE SYSTEM ACCESS COORDINATOR (FILE SYSTEM ACCESS API)
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * UTILITY: BrowserFileSystemAccessCoordinator
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Implements client-side direct access to the user machine's local file system using the
 * native Browser File System Access API (`window.showDirectoryPicker()`).
 *
 * Persists directory handle permissions in IndexedDB and provides full read, write, list,
 * and live folder synchronization between the user's computer disk and DocuStack virtual storage.
 *
 * Architecture Flow:
 * ┌───────────────────────────────────────────────────────────┐
 * │ User Clicks "Connect Machine Folder"                      │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ window.showDirectoryPicker({ mode: 'readwrite' })         │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ Store Handle in IndexedDB ('docustack_browser_fs')        │
 * └─────────────────────────────┬─────────────────────────────┘
 *                               │
 *                               ▼
 * ┌───────────────────────────────────────────────────────────┐
 * │ Direct Native Disk Read / Write / List Stream Operations  │
 * └───────────────────────────────────────────────────────────┘
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export interface BrowserFileEntry {
  name: string;
  relativePath: string;
  kind: 'file' | 'directory';
  sizeFormatted?: string;
  sizeBytes?: number;
  lastModified?: number;
}

const DB_NAME = 'docustack_browser_fs_db';
const STORE_NAME = 'directory_handles';
const HANDLE_KEY = 'primary_machine_vault_handle';

export class BrowserFileSystemAccessCoordinator {
  private static directoryHandle: FileSystemDirectoryHandle | null = null;
  private static folderName: string = '';

  /**
   * Detects whether the current browser supports the native File System Access API.
   */
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Prompts the user to pick a local folder on their computer with read/write access.
   */
  public static async selectLocalDirectory(): Promise<{
    success: boolean;
    folderName: string;
    error?: string;
  }> {
    if (!this.isSupported()) {
      const isBrave = typeof window !== 'undefined' && Boolean((window.navigator as any)?.brave);
      return {
        success: false,
        folderName: '',
        error: isBrave
          ? 'Brave blocks the File System Access API by default. Open "brave://flags/#file-system-access-api", set it to "Enabled", and relaunch Brave.'
          : 'File System Access API is not supported in this browser. Please use Chrome, Edge, or enable the flag in Brave.',
      };
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      this.directoryHandle = handle;
      this.folderName = handle.name;

      // Save handle into IndexedDB for persistent reconnection
      await this.saveHandleToIndexedDB(handle);

      return {
        success: true,
        folderName: handle.name,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, folderName: '', error: 'Directory selection was cancelled.' };
      }
      return { success: false, folderName: '', error: err.message || 'Failed to select local directory.' };
    }
  }

  /**
   * Attempts to reconnect to previously granted local directory handle from IndexedDB.
   */
  public static async reconnectSavedDirectory(): Promise<{
    connected: boolean;
    folderName: string;
  }> {
    if (!this.isSupported()) return { connected: false, folderName: '' };

    try {
      const handle = await this.getHandleFromIndexedDB();
      if (!handle) return { connected: false, folderName: '' };

      // Query or request permission if needed
      const opts = { mode: 'readwrite' };
      if ((await (handle as any).queryPermission(opts)) === 'granted') {
        this.directoryHandle = handle;
        this.folderName = handle.name;
        return { connected: true, folderName: handle.name };
      }

      if ((await (handle as any).requestPermission(opts)) === 'granted') {
        this.directoryHandle = handle;
        this.folderName = handle.name;
        return { connected: true, folderName: handle.name };
      }

      return { connected: false, folderName: '' };
    } catch {
      return { connected: false, folderName: '' };
    }
  }

  /**
   * Disconnects active local directory handle.
   */
  public static async disconnectDirectory(): Promise<void> {
    this.directoryHandle = null;
    this.folderName = '';
    await this.deleteHandleFromIndexedDB();
  }

  public static isConnected(): boolean {
    return this.directoryHandle !== null;
  }

  public static getConnectedFolderName(): string {
    return this.folderName;
  }

  /**
   * Reads the UTF-8 text content of a file from the connected local machine folder.
   */
  public static async readFile(relativePath: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('LOCAL_DISK_NOT_CONNECTED: No local machine folder is currently connected.');
    }

    const pathParts = relativePath.split('/').filter(Boolean);
    const fileName = pathParts.pop()!;
    let currentHandle = this.directoryHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
    }

    const fileHandle = await currentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * Writes content directly to a file inside the user machine's local directory.
   */
  public static async writeFile(relativePath: string, content: string | Uint8Array): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('LOCAL_DISK_NOT_CONNECTED: No local machine folder is currently connected.');
    }

    const pathParts = relativePath.split('/').filter(Boolean);
    const fileName = pathParts.pop()!;
    let currentHandle = this.directoryHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Deletes a file from the connected local machine folder.
   */
  public static async deleteFile(relativePath: string): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('LOCAL_DISK_NOT_CONNECTED: No local machine folder is currently connected.');
    }

    const pathParts = relativePath.split('/').filter(Boolean);
    const fileName = pathParts.pop()!;
    let currentHandle = this.directoryHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
    }

    await currentHandle.removeEntry(fileName);
  }

  /**
   * Recursively builds a structured FileTreeNode tree for UI directory rendering.
   */
  public static async listDirectoryTree(): Promise<{
    name: string;
    relativePath: string;
    absolutePath: string;
    isDirectory: boolean;
    children: any[];
  }> {
    if (!this.directoryHandle) {
      return {
        name: 'Local Computer (Disconnected)',
        relativePath: '',
        absolutePath: '',
        isDirectory: true,
        children: [],
      };
    }

    const scanNode = async (
      handle: FileSystemDirectoryHandle,
      currentRelPath: string
    ): Promise<any> => {
      const children: any[] = [];
      for await (const [name, childHandle] of (handle as any).entries()) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const relPath = currentRelPath ? `${currentRelPath}/${name}` : name;

        if (childHandle.kind === 'directory') {
          const subTree = await scanNode(childHandle as FileSystemDirectoryHandle, relPath);
          children.push(subTree);
        } else if (childHandle.kind === 'file') {
          const file = await (childHandle as FileSystemFileHandle).getFile();
          const sizeKb = (file.size / 1024).toFixed(1);
          children.push({
            name,
            relativePath: relPath,
            absolutePath: `local://${relPath}`,
            isDirectory: false,
            sizeBytes: file.size,
            sizeFormatted: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`,
            modifiedAt: new Date(file.lastModified).toISOString(),
          });
        }
      }
      return {
        name: handle.name,
        relativePath: currentRelPath,
        absolutePath: `local://${currentRelPath}`,
        isDirectory: true,
        children,
      };
    };

    return await scanNode(this.directoryHandle, '');
  }

  /**
   * Recursively scans and lists files inside the connected local directory on the user's computer.
   */
  public static async listFiles(subDir: string = ''): Promise<BrowserFileEntry[]> {
    if (!this.directoryHandle) return [];

    let startHandle = this.directoryHandle;
    if (subDir) {
      const parts = subDir.split('/').filter(Boolean);
      for (const part of parts) {
        startHandle = await startHandle.getDirectoryHandle(part, { create: false });
      }
    }

    const results: BrowserFileEntry[] = [];

    const scanDirectory = async (dirHandle: FileSystemDirectoryHandle, currentRelPath: string) => {
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const relPath = currentRelPath ? `${currentRelPath}/${name}` : name;

        if (handle.kind === 'directory') {
          results.push({
            name,
            relativePath: relPath,
            kind: 'directory',
          });
          await scanDirectory(handle as FileSystemDirectoryHandle, relPath);
        } else if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          const sizeKb = (file.size / 1024).toFixed(1);
          results.push({
            name,
            relativePath: relPath,
            kind: 'file',
            sizeBytes: file.size,
            sizeFormatted: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`,
            lastModified: file.lastModified,
          });
        }
      }
    };

    await scanDirectory(startHandle, subDir);
    return results;
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // INDEXEDDB HANDLE STORAGE HELPERS
  // ══════════════════════════════════════════════════════════════════════════════════════════

  private static openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private static async saveHandleToIndexedDB(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    } catch {
      // IndexedDB persistence fallback
    }
  }

  private static async getHandleFromIndexedDB(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private static async deleteHandleFromIndexedDB(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    } catch {
      // IndexedDB persistence fallback
    }
  }
}

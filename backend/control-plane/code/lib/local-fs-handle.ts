/**
 * Browser Local Filesystem Access API & IndexedDB Directory Handle Persistence
 *
 * Enables selecting local folders via window.showDirectoryPicker() when running
 * in browser (e.g. deployed on Vercel or local), storing handles in browser IndexedDB,
 * and seamlessly re-opening local workspaces on subsequent sessions.
 */

const DB_NAME = 'DocuStack_LocalFS_Vault';
const STORE_NAME = 'directory_handles';
const DB_VERSION = 1;

function openLocalFsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('INDEXEDDB_UNAVAILABLE: IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('FAILED_TO_OPEN_INDEXEDDB'));
  });
}

/**
 * Check if the browser supports the File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

/**
 * Save a FileSystemDirectoryHandle into IndexedDB
 */
export async function saveLocalDirectoryHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openLocalFsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put({
      key,
      handle,
      name: handle.name,
      savedAt: new Date().toISOString(),
    });

    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error || new Error(`FAILED_TO_SAVE_HANDLE_${key}`));
  });
}

/**
 * Retrieve a FileSystemDirectoryHandle from IndexedDB by key
 */
export async function getLocalDirectoryHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openLocalFsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(key);

      getReq.onsuccess = () => {
        const result = getReq.result;
        if (result && result.handle) {
          resolve(result.handle as FileSystemDirectoryHandle);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error || new Error(`FAILED_TO_GET_HANDLE_${key}`));
    });
  } catch (err) {
    console.warn('[DocuStack LocalFS] Could not retrieve handle from IndexedDB:', err);
    return null;
  }
}

/**
 * Remove a FileSystemDirectoryHandle from IndexedDB
 */
export async function removeLocalDirectoryHandle(key: string): Promise<void> {
  try {
    const db = await openLocalFsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(key);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    });
  } catch (err) {
    console.warn('[DocuStack LocalFS] Could not delete handle from IndexedDB:', err);
  }
}

/**
 * Verify or query permission on a FileSystemDirectoryHandle
 */
export async function verifyDirectoryHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const options = { mode };

  try {
    // Check if permission was already granted
    if ((await (handle as any).queryPermission(options)) === 'granted') {
      return true;
    }
    // Request permission from user
    if ((await (handle as any).requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (err) {
    console.warn('[DocuStack LocalFS] Permission check error:', err);
  }

  return false;
}

/**
 * Launch native browser directory picker
 */
export async function promptSelectLocalFolder(): Promise<{
  handle: FileSystemDirectoryHandle;
  folderName: string;
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'BROWSER_UNSUPPORTED: Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera.'
    );
  }

  try {
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });

    const isGranted = await verifyDirectoryHandlePermission(handle, 'readwrite');
    if (!isGranted) {
      throw new Error('PERMISSION_DENIED: Read/write permission to the folder was not granted.');
    }

    return {
      handle,
      folderName: handle.name,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('USER_CANCELLED: Folder selection was cancelled.');
    }
    throw err;
  }
}

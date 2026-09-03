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
 * Detects whether the current browser is Brave.
 */
export async function isBraveBrowser(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as any;
  if (nav.brave && typeof nav.brave.isBrave === 'function') {
    try {
      return await nav.brave.isBrave();
    } catch {
      return true;
    }
  }
  return false;
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
    if (typeof (handle as any).queryPermission === 'function') {
      if ((await (handle as any).queryPermission(options)) === 'granted') {
        return true;
      }
    }
    // Request permission from user
    if (typeof (handle as any).requestPermission === 'function') {
      if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch (err) {
    console.warn('[DocuStack LocalFS] Permission check error:', err);
  }

  return Boolean(handle && handle.name);
}

/**
 * Launch native browser directory picker
 */
export async function promptSelectLocalFolder(): Promise<{
  handle: FileSystemDirectoryHandle;
  folderName: string;
}> {
  if (!isFileSystemAccessSupported()) {
    const isBrave = typeof window !== 'undefined' && Boolean((window.navigator as any)?.brave);
    if (isBrave) {
      throw new Error(
        'BRAVE_FLAG_REQUIRED: Brave disables the File System Access API by default. Open "brave://flags/#file-system-access-api", set it to "Enabled", and relaunch Brave.'
      );
    }
    throw new Error(
      'BROWSER_UNSUPPORTED: Your browser does not support the File System Access API. Please use Chrome, Edge, or enable the flag in Brave.'
    );
  }

  try {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
    } catch (pickerErr: any) {
      if (pickerErr.name === 'AbortError') throw pickerErr;
      // Fallback invocation without mode argument if browser throws on options dictionary
      handle = await (window as any).showDirectoryPicker();
    }

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

export interface LocalSyncProgress {
  percent: number;
  statusMessage: string;
  currentFile: string;
  completedFiles: number;
  totalFiles: number;
}

/**
 * Synchronize all workspace files, categories, manifests, and documents directly
 * into a native FileSystemDirectoryHandle on the user's host machine.
 */
export async function syncWorkspaceToDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  workspaceName: string,
  data: {
    nodes?: any[];
    categories?: any[];
    documents?: any[];
    edges?: any[];
    groups?: any[];
  },
  onProgress?: (progress: LocalSyncProgress) => void
): Promise<{ filesWritten: number }> {
  async function writeHandleFile(relPath: string, content: string): Promise<void> {
    const parts = relPath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let current = dirHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
  }

  const docs = data.documents || [];
  const categories = data.categories || [];

  // Use actual workspace categories as folder names, not hardcoded placeholders
  // Each category becomes a real folder; documents go inside their category folder
  const catFolderMap = new Map<string, string>(); // categoryId -> safe folder name
  for (const cat of categories) {
    const safeFolder = (cat.title || 'Uncategorized').replace(/[^a-zA-Z0-9_-]/g, '_');
    catFolderMap.set(cat.id, safeFolder);
  }

  // Compute total file count: 4 manifests + 1 per category (README) + 1 per doc (or 1 welcome)
  const totalFiles = 4 + Math.max(1, categories.length) + Math.max(1, docs.length);
  let completed = 0;

  function report(file: string) {
    completed++;
    const pct = Math.round((completed / totalFiles) * 100);
    onProgress?.({
      percent: Math.min(100, pct),
      statusMessage: `Writing ${file}...`,
      currentFile: file,
      completedFiles: completed,
      totalFiles,
    });
  }

  // 1. .docustack/manifest.json
  const manifest = {
    workspaceName,
    app: 'docustack',
    ecosystem: 'ultrst',
    syncedAt: new Date().toISOString(),
    totalDocuments: docs.length,
    totalCategories: categories.length,
  };
  await writeHandleFile('.docustack/manifest.json', JSON.stringify(manifest, null, 2));
  report('.docustack/manifest.json');

  // 2. .docustack/graph.json
  const graph = {
    nodes: data.nodes || [],
    edges: data.edges || [],
    groups: data.groups || [],
  };
  await writeHandleFile('.docustack/graph.json', JSON.stringify(graph, null, 2));
  report('.docustack/graph.json');

  // 3. .docustack/categories.json
  await writeHandleFile('.docustack/categories.json', JSON.stringify(categories, null, 2));
  report('.docustack/categories.json');

  // 4. .docustack/documents_index.json
  await writeHandleFile('.docustack/documents_index.json', JSON.stringify(docs, null, 2));
  report('.docustack/documents_index.json');

  // 5. Create a README.md inside each actual category folder
  if (categories.length === 0) {
    // No real categories — create an Inbox placeholder folder
    await writeHandleFile('Inbox/README.md', `# Inbox\nDocuments without a category are stored here.\n`);
    report('Inbox/README.md');
  } else {
    for (const cat of categories) {
      const safeFolder = catFolderMap.get(cat.id) || 'Uncategorized';
      const readmeContent = `# ${cat.title || safeFolder}\n${cat.description ? cat.description + '\n' : ''}\nCategory folder for workspace **${workspaceName}**.\n`;
      await writeHandleFile(`${safeFolder}/README.md`, readmeContent);
      report(`${safeFolder}/README.md`);
    }
  }

  // 6. Documents — written into their real category folder
  if (docs.length === 0) {
    const welcome = `# Welcome to ${workspaceName}\n\nThis workspace is synced to your local machine folder.\nCreate documents in DocuStack and sync again to see them here.\n`;
    await writeHandleFile('Inbox/welcome_guide.md', welcome);
    report('Inbox/welcome_guide.md');
  } else {
    for (const doc of docs) {
      const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.endsWith('.md') ? safeTitle : `${safeTitle}.md`;
      const catFolder = catFolderMap.get(doc.categoryId) || 'Inbox';
      const targetPath = `${catFolder}/${filename}`;
      const cat = categories.find((c: any) => c.id === doc.categoryId);
      const frontmatter = `---\nid: "${doc.id}"\ntitle: "${doc.title}"\ncategory: "${cat?.title || 'Inbox'}"\ntags: ${JSON.stringify(doc.tags || [])}\ncreated: "${doc.createdAt || doc.uploadedAt || new Date().toISOString()}"\n---\n\n${doc.content || `# ${doc.title}\n`}`;
      await writeHandleFile(targetPath, frontmatter);
      report(targetPath);
    }
  }

  return { filesWritten: completed };
}

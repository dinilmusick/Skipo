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

let globalActiveLocalHandle: FileSystemDirectoryHandle | null = null;

export function setActiveLocalDirectoryHandle(handle: FileSystemDirectoryHandle | null): void {
  globalActiveLocalHandle = handle;
}

export function getActiveLocalDirectoryHandle(): FileSystemDirectoryHandle | null {
  return globalActiveLocalHandle;
}

export interface LocalDirectoryInitResult {
  status: 'connected' | 'unavailable_on_machine' | 'unsupported' | 'permission_denied' | 'error';
  handle: FileSystemDirectoryHandle | null;
  folderName: string;
  message?: string;
}

/**
 * Automatically initializes and establishes the connection to a saved local directory on page load.
 * Does NOT require manual user clicks if the browser permits or if previously granted.
 * If the directory handle does not exist in IndexedDB (e.g. opened on a different machine),
 * it reports 'unavailable_on_machine', allowing the app to disable local storage for this session.
 */
export async function autoInitializeLocalDirectory(
  folderKey: string,
  folderName: string = 'Local Folder'
): Promise<LocalDirectoryInitResult> {
  if (!isFileSystemAccessSupported()) {
    return {
      status: 'unsupported',
      handle: null,
      folderName,
      message: 'File System Access API is not supported in this browser.',
    };
  }

  if (!folderKey) {
    return {
      status: 'unavailable_on_machine',
      handle: null,
      folderName,
      message: 'No local folder key was provided.',
    };
  }

  try {
    const handle = await getLocalDirectoryHandle(folderKey);
    if (!handle) {
      return {
        status: 'unavailable_on_machine',
        handle: null,
        folderName,
        message: `Local directory "${folderName}" is not available on this machine/browser.`,
      };
    }

    let isGranted = false;
    try {
      if (typeof (handle as any).queryPermission === 'function') {
        const queryState = await (handle as any).queryPermission({ mode: 'readwrite' });
        if (queryState === 'granted') {
          isGranted = true;
        }
      }
    } catch {}

    if (!isGranted && typeof (handle as any).requestPermission === 'function') {
      try {
        const reqState = await (handle as any).requestPermission({ mode: 'readwrite' });
        if (reqState === 'granted') {
          isGranted = true;
        }
      } catch {
        // In browser versions requiring user gesture for requestPermission,
        // we catch and proceed to check whether basic read access exists
      }
    }

    // Verify handle responsiveness
    try {
      if (isGranted) {
        setActiveLocalDirectoryHandle(handle);
        return {
          status: 'connected',
          handle,
          folderName: handle.name || folderName,
          message: `Connected directly to local directory "${handle.name || folderName}".`,
        };
      } else {
        // Query read-only as fallback check
        let canRead = false;
        try {
          if (typeof (handle as any).queryPermission === 'function') {
            canRead = (await (handle as any).queryPermission({ mode: 'read' })) === 'granted';
          }
        } catch {}

        if (canRead) {
          setActiveLocalDirectoryHandle(handle);
          return {
            status: 'connected',
            handle,
            folderName: handle.name || folderName,
            message: `Connected to local directory "${handle.name || folderName}".`,
          };
        }

        return {
          status: 'permission_denied',
          handle,
          folderName: handle.name || folderName,
          message: `Permission to access local folder "${handle.name || folderName}" was not granted.`,
        };
      }
    } catch (probeErr: any) {
      return {
        status: 'unavailable_on_machine',
        handle: null,
        folderName,
        message: `Directory "${folderName}" could not be accessed on this machine: ${probeErr.message}`,
      };
    }
  } catch (err: any) {
    return {
      status: 'error',
      handle: null,
      folderName,
      message: err?.message || 'Failed to initialize local directory handle.',
    };
  }
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
 * Sanitize a raw title into a safe local folder name (mirrors getSafeCloudFolderName in cloud-storage-service.ts)
 */
function getSafeFolderName(rawTitle: string): string {
  const sanitized = (rawTitle || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_');
  return sanitized || 'folder';
}

/**
 * Synchronize all workspace files, categories, manifests, and documents directly
 * into a native FileSystemDirectoryHandle on the user's host machine.
 *
 * Structure mirrors the cloud bucket exactly:
 *   <selectedFolder>/
 *     <workspaceFolderPrefix>/          ← same name as cloud bucket prefix
 *       .docustack/
 *         manifest.json
 *         graph.json
 *         categories.json
 *         documents_index.json
 *       <FolderNode_Title>/             ← one per Folder-type graph node
 *         .keep
 *         README.md
 *       <KanbanBoard_Title>/            ← one per Kanban-type graph node
 *         kanban_board.json
 *         <Column_Title>/
 *           .keep
 *           README.md
 *           <document>.md              ← docs in that column
 *       inbox/                         ← uncategorized documents
 *         <document>.md
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
    folderPrefix?: string | null;
    vaultName?: string | null;
  },
  onProgress?: (progress: LocalSyncProgress) => void,
  folderPrefixOverride?: string
): Promise<{ filesWritten: number }> {
  // Determine the workspace subfolder name (same as cloud bucket folderPrefix)
  let rawSubfolder = (
    folderPrefixOverride ||
    data.folderPrefix ||
    ''
  ).trim();

  // If rawSubfolder is an absolute path or contains slashes, extract ultrst_* or the basename
  if (rawSubfolder.includes('/')) {
    const parts = rawSubfolder.split('/').filter(Boolean);
    const ultrstPart = parts.find((p) => p.startsWith('ultrst_'));
    rawSubfolder = ultrstPart || parts[parts.length - 1];
  }

  const workspaceSubfolder = (rawSubfolder || workspaceName).replace(/^\.\//, '').replace(/\/+$/, '');

  // Get (or create) the workspace subfolder inside the selected local folder
  let wsDir = dirHandle;
  if (workspaceSubfolder) {
    // Navigate into nested path if the prefix contains slashes
    const parts = workspaceSubfolder.split('/').filter(Boolean);
    for (const part of parts) {
      wsDir = await wsDir.getDirectoryHandle(part, { create: true });
    }
  }

  async function writeFile(relPath: string, content: string): Promise<void> {
    const parts = relPath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let current = wsDir;
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
  const nodes = data.nodes || [];

  // Separate node types
  const folderNodes = nodes.filter(
    (n: any) => !n.isWorkspaceRoot && (n.type === 'folder' || n.glyph === 'Folder')
  );
  const kanbanNodes = nodes.filter(
    (n: any) => !n.isWorkspaceRoot && (n.type === 'collection' || n.glyph === 'Kanban')
  );

  // Compute total file count
  const kanbanColCount = kanbanNodes.reduce((sum: number, n: any) => {
    const boardId = n.collectionId || n.id;
    const cols = categories.filter((c: any) => c.boardId === boardId);
    return sum + (cols.length > 0 ? cols.length : 3); // default 3 cols if none
  }, 0);
  const totalFiles =
    4 + // .docustack manifests
    folderNodes.length * 2 + // .keep + README per folder
    kanbanNodes.length + // kanban_board.json per board
    kanbanColCount * 2 + // .keep + README per column
    categories.length * 2 + // .keep + README per category at root
    1 + // inbox/.keep
    Math.max(1, docs.length); // documents
  let completed = 0;

  function report(file: string) {
    completed++;
    onProgress?.({
      percent: Math.min(99, Math.round((completed / totalFiles) * 100)),
      statusMessage: `Writing ${file}...`,
      currentFile: file,
      completedFiles: completed,
      totalFiles,
    });
  }

  // 1. .docustack/manifest.json
  const manifest = {
    workspaceName: data.vaultName || workspaceName,
    app: 'docustack',
    ecosystem: 'ultrst',
    syncedAt: new Date().toISOString(),
    totalDocuments: docs.length,
    totalCategories: categories.length,
    workspaceFolderPrefix: workspaceSubfolder,
  };
  await writeFile('.docustack/manifest.json', JSON.stringify(manifest, null, 2));
  report('.docustack/manifest.json');

  // 2. .docustack/graph.json
  await writeFile('.docustack/graph.json', JSON.stringify({ nodes, edges: data.edges || [], groups: data.groups || [] }, null, 2));
  report('.docustack/graph.json');

  // 3. .docustack/categories.json
  await writeFile('.docustack/categories.json', JSON.stringify(categories, null, 2));
  report('.docustack/categories.json');

  // 4. .docustack/documents_index.json
  await writeFile('.docustack/documents_index.json', JSON.stringify(docs, null, 2));
  report('.docustack/documents_index.json');

  // 5. Folder nodes → plain directory with .keep + README
  for (const node of folderNodes) {
    const folderName = getSafeFolderName(node.title || 'Folder');
    const readme = `# ${node.title || 'Folder'}\n\nFolder created in DocuStack Workspace.\n- Tags: ${(node.tags || []).join(', ') || 'none'}\n- Created: ${new Date().toISOString()}\n`;
    await writeFile(`${folderName}/.keep`, '');
    report(`${folderName}/.keep`);
    await writeFile(`${folderName}/README.md`, readme);
    report(`${folderName}/README.md`);
  }

  // 6. Kanban board nodes → board folder with kanban_board.json + column subfolders
  for (const node of kanbanNodes) {
    const boardFolder = getSafeFolderName(node.title || 'Kanban_Board');
    const boardId = node.collectionId || node.id;
    const boardCols = categories.filter((c: any) => c.boardId === boardId);

    const boardManifest = {
      id: boardId,
      title: node.title || 'Kanban Board',
      glyph: node.glyph || 'Kanban',
      color: node.color || '#D4AF37',
      tags: node.tags || ['Kanban'],
      columns: boardCols.map((c: any) => ({
        id: c.id,
        title: c.title,
        glyph: c.glyph,
        color: c.color,
        description: c.description,
      })),
      updatedAt: new Date().toISOString(),
    };
    await writeFile(`${boardFolder}/kanban_board.json`, JSON.stringify(boardManifest, null, 2));
    report(`${boardFolder}/kanban_board.json`);

    const colsToCreate = boardCols.length > 0
      ? boardCols
      : [{ id: 'todo', title: 'To Do' }, { id: 'progress', title: 'In Progress' }, { id: 'done', title: 'Done' }];

    for (const col of colsToCreate) {
      const colName = getSafeFolderName(col.title);
      const readme = `# ${col.title}\nColumn for Kanban board **${node.title}**.\n`;
      await writeFile(`${boardFolder}/${colName}/.keep`, '');
      report(`${boardFolder}/${colName}/.keep`);
      await writeFile(`${boardFolder}/${colName}/README.md`, readme);
      report(`${boardFolder}/${colName}/README.md`);
    }
  }

  // 6b. Categories folders → ensure all categories also exist physically at root (matching cloud bucket layout)
  for (const cat of categories) {
    const catFolder = getSafeFolderName(cat.title || 'Category');
    const readme = `# ${cat.title || catFolder}\n${cat.description ? cat.description + '\n' : ''}\nCategory folder for workspace **${data.vaultName || workspaceName}**.\n`;
    await writeFile(`${catFolder}/.keep`, '');
    report(`${catFolder}/.keep`);
    await writeFile(`${catFolder}/README.md`, readme);
    report(`${catFolder}/README.md`);
  }

  // 6c. Always ensure inbox folder exists with .keep
  await writeFile('inbox/.keep', '');
  report('inbox/.keep');

  // 7. Documents — placed into exact same path as cloud sync
  if (docs.length === 0) {
    const welcome = `# Welcome to ${data.vaultName || workspaceName}\n\nThis workspace is synced to your local machine folder.\nCreate documents in DocuStack and sync again to see them here.\n`;
    await writeFile('inbox/welcome_guide.md', welcome);
    report('inbox/welcome_guide.md');
  } else {
    for (const doc of docs) {
      const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;
      const assignedCat = categories.find((c: any) => c.id === doc.categoryId);
      let targetPath = `inbox/${filename}`;

      if (assignedCat) {
        const catFolder = getSafeFolderName(assignedCat.title);
        if (assignedCat.boardId) {
          const boardNode = nodes.find((n: any) => (n.collectionId || n.id) === assignedCat.boardId);
          const boardFolder = getSafeFolderName(boardNode?.title || 'Kanban');
          targetPath = `${boardFolder}/${catFolder}/${filename}`;
        } else {
          targetPath = `${catFolder}/${filename}`;
        }
      }

      const frontmatter = `---\nid: "${doc.id}"\ntitle: "${doc.title}"\ncategory: "${assignedCat?.title || 'Inbox'}"\ntags: ${JSON.stringify(doc.tags || [])}\ncreated: "${doc.createdAt || doc.uploadedAt || new Date().toISOString()}"\n---\n\n${doc.content || `# ${doc.title}\n`}`;
      await writeFile(targetPath, frontmatter);
      report(targetPath);
    }
  }

  // 8. Reconciliation: Prune orphaned directories or files from wsDir
  try {
    const validTopLevelDirs = new Set<string>([
      '.docustack',
      'inbox',
      ...folderNodes.map((n: any) => getSafeFolderName(n.title)),
      ...kanbanNodes.map((n: any) => getSafeFolderName(n.title)),
      ...categories.filter((c: any) => !c.boardId).map((c: any) => getSafeFolderName(c.title)),
    ]);

    const anyWsDir = wsDir as any;
    if (typeof anyWsDir.entries === 'function') {
      for await (const [entryName, handle] of anyWsDir.entries()) {
        if (handle.kind === 'directory') {
          if (!validTopLevelDirs.has(entryName)) {
            try {
              await anyWsDir.removeEntry(entryName, { recursive: true });
            } catch {}
          } else if (kanbanNodes.some((k: any) => getSafeFolderName(k.title) === entryName)) {
            // Inside kanban board, prune orphaned column folders
            const targetBoard = kanbanNodes.find((k: any) => getSafeFolderName(k.title) === entryName);
            const boardId = targetBoard.collectionId || targetBoard.id;
            const validColNames = new Set(
              categories.filter((c: any) => c.boardId === boardId).map((c: any) => getSafeFolderName(c.title))
            );
            const subDirHandle = handle as any;
            if (typeof subDirHandle.entries === 'function') {
              for await (const [subName, subHandle] of subDirHandle.entries()) {
                if (subHandle.kind === 'directory' && !validColNames.has(subName)) {
                  try {
                    await subDirHandle.removeEntry(subName, { recursive: true });
                  } catch {}
                }
              }
            }
          }
        }
      }
    }
  } catch (pruneErr) {
    console.warn('[LocalSync] Pruning warning:', pruneErr);
  }

  onProgress?.({
    percent: 100,
    statusMessage: `✓ Synced ${completed} files to "${workspaceSubfolder}"`,
    currentFile: '',
    completedFiles: completed,
    totalFiles: completed,
  });

  return { filesWritten: completed };
}

/**
 * Remove a specific relative file or directory entry from a local DirectoryHandle
 */
export async function removeEntryFromLocalHandle(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
  subfolder?: string
): Promise<boolean> {
  try {
    let rawSubfolder = (subfolder || '').trim();
    if (rawSubfolder.includes('/')) {
      const parts = rawSubfolder.split('/').filter(Boolean);
      const ultrstPart = parts.find((p) => p.startsWith('ultrst_'));
      rawSubfolder = ultrstPart || parts[parts.length - 1];
    }
    const workspaceSubfolder = rawSubfolder.replace(/^\.\//, '').replace(/\/+$/, '');

    let wsDir = dirHandle;
    if (workspaceSubfolder) {
      const parts = workspaceSubfolder.split('/').filter(Boolean);
      for (const part of parts) {
        wsDir = await wsDir.getDirectoryHandle(part, { create: false });
      }
    }

    const cleanRel = relativePath.replace(/^\/+|\/+$/g, '');
    const parts = cleanRel.split('/').filter(Boolean);
    const targetName = parts.pop();
    if (!targetName) return false;

    let current = wsDir;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: false });
    }

    await (current as any).removeEntry(targetName, { recursive: true });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Completely purges a workspace folder and all its contents from a local FileSystemDirectoryHandle.
 * Tests multiple candidate subfolder names (canonical, raw name, sanitized) to ensure
 * the entire folder is expunged from the user's host machine.
 */
export async function purgeWorkspaceFromLocalHandle(
  dirHandle: FileSystemDirectoryHandle,
  candidateFolderNames: string[]
): Promise<{ success: boolean; purgedFolders: string[] }> {
  const purgedFolders: string[] = [];
  const checked = new Set<string>();

  for (const raw of candidateFolderNames) {
    if (!raw) continue;
    let target = raw.trim().replace(/^\.\//, '').replace(/\/+$/, '');
    if (target.includes('/')) {
      const parts = target.split('/').filter(Boolean);
      const ultrstPart = parts.find((p) => p.startsWith('ultrst_'));
      target = ultrstPart || parts[parts.length - 1];
    }
    if (!target || checked.has(target)) continue;
    checked.add(target);

    try {
      if (typeof (dirHandle as any).removeEntry === 'function') {
        await (dirHandle as any).removeEntry(target, { recursive: true });
        purgedFolders.push(target);
      }
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        console.warn(`[LocalFS] Could not remove entry "${target}":`, err);
      }
    }
  }

  return { success: purgedFolders.length > 0, purgedFolders };
}


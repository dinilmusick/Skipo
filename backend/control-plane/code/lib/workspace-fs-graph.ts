import fs from 'fs';
import path from 'path';
import { DocumentItem, DocCategory, GraphNode, GraphEdge, GraphGroup } from './types';
import { INITIAL_NODES, INITIAL_EDGES } from './theme';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  deleteCloudWorkspaceFile,
  deleteCloudWorkspaceFolder,
  syncFolderNodeToCloud,
  syncKanbanNodeToCloud,
  syncEntireWorkspaceToCloud,
  getSafeCloudFolderName,
} from './cloud-storage-service';
import {
  ensureWorkspaceExists,
  getVaultAbsolutePath,
  globalActiveVaultPath,
  globalActiveVaultName,
  globalActiveStorageConn,
  globalActiveFolderPrefix,
} from './workspace-fs-core';
import { loadCategoriesFromFS, saveCategoriesToFS } from './workspace-fs-categories';
import {
  loadDocumentsFromFS,
  saveDocumentToFS,
  resolveDocumentStoragePath,
} from './workspace-fs-documents';

// ----------------------------------------------------------------------
// GRAPH TOPOLOGY & GROUPS FS HANDLERS
// ----------------------------------------------------------------------

export function syncStickyNoteToDisk(node: GraphNode): GraphNode {
  if (node.type !== 'sticky') return node;

  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const notesDir = path.join(vaultPath, 'notes');

  const safeName = (node.id || 'quick_note')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/\.txt$/i, '');
  
  const fileName = `${safeName}.txt`;
  const filePath = path.join(notesDir, fileName);

  const fileContent = node.content || '';

  try {
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    return {
      ...node,
      txtFilePath: filePath,
    };
  } catch (err) {
    console.warn('[workspaceFS] Sticky note local write bypassed:', err);
    return node;
  }
}

export function loadGraphFromFS(): { nodes: GraphNode[]; edges: GraphEdge[]; groups: GraphGroup[] } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'graph.json');

  const defaultNodes = INITIAL_NODES.map((n) =>
    n.isWorkspaceRoot ? { ...n, workspacePath: vaultPath, title: globalActiveVaultName || n.title } : n
  );

  if (!fs.existsSync(file)) {
    return { nodes: defaultNodes, edges: INITIAL_EDGES, groups: [] };
  }

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    const nodes: GraphNode[] = (data.nodes || defaultNodes).map((n: GraphNode) => {
      let updated = { ...n };
      if (updated.isWorkspaceRoot && globalActiveVaultName) {
        updated.title = globalActiveVaultName;
      }
      if (updated.type === 'sticky' && updated.txtFilePath && fs.existsSync(updated.txtFilePath)) {
        try {
          updated.content = fs.readFileSync(updated.txtFilePath, 'utf-8');
        } catch {
          // Keep existing content
        }
      }
      return updated;
    });
    return { nodes, edges: data.edges || INITIAL_EDGES, groups: data.groups || [] };
  } catch {
    return { nodes: defaultNodes, edges: INITIAL_EDGES, groups: [] };
  }
}

export async function loadGraphFromFSAsync(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
}> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'graph.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/graph.json'
      );
      if (cloudRaw) {
        const cloudData = JSON.parse(cloudRaw);
        if (cloudData && Array.isArray(cloudData.nodes) && cloudData.nodes.length > 0) {
          const mappedNodes = cloudData.nodes.map((n: GraphNode) => {
            if (n.isWorkspaceRoot && globalActiveVaultName) {
              return { ...n, title: globalActiveVaultName, workspacePath: globalActiveVaultPath || n.workspacePath };
            }
            return n;
          });
          try {
            fs.writeFileSync(
              file,
              JSON.stringify({ nodes: mappedNodes, edges: cloudData.edges || [], groups: cloudData.groups || [] }, null, 2),
              'utf-8'
            );
          } catch {}
          return {
            nodes: mappedNodes,
            edges: cloudData.edges || INITIAL_EDGES,
            groups: cloudData.groups || [],
          };
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadGraphFromFSAsync fallback:', e);
    }
  }

  return loadGraphFromFS();
}

import { resolveNodeNestedPath } from './workspace-canonical';
export { resolveNodeNestedPath };

export async function saveGraphToFSAsync(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups: GraphGroup[] = []
): Promise<void> {
  saveGraphToFS(nodes, edges, groups);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const syncedNodes = nodes.map((n) => {
      let current = n.type === 'sticky' ? syncStickyNoteToDisk(n) : n;
      if (current.isWorkspaceRoot && globalActiveVaultName) {
        current = { ...current, title: globalActiveVaultName };
      }
      return current;
    });

    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/graph.json',
        JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2),
        'application/json'
      );

      const allCategories = loadCategoriesFromFS();
      for (const n of syncedNodes) {
        if (n.isWorkspaceRoot || !n.title || !n.title.trim()) continue;
        // Resolve the full nested path (e.g. "Projects/Frontend") so children are stored inside parent folders
        const nestedPath = resolveNodeNestedPath(n, syncedNodes, edges);
        if (n.type === 'folder' || n.glyph === 'Folder') {
          await syncFolderNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, nestedPath);
        } else if (n.type === 'collection' || n.glyph === 'Kanban') {
          const boardId = n.collectionId || n.id;
          const boardCols = allCategories.filter((c) => c.boardId === boardId);
          await syncKanbanNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, boardCols, nestedPath);
        }
      }
    } catch (err) {
      console.warn('[CloudStorage] saveGraphToFSAsync error:', err);
    }
  }
}

export function saveGraphToFS(nodes: GraphNode[], edges: GraphEdge[], groups: GraphGroup[] = []) {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const file = path.join(metaDir, 'graph.json');

  // Process sticky nodes to sync physical .txt files and ensure root node title matches active workspace
  const syncedNodes = nodes.map((n) => {
    let current = n.type === 'sticky' ? syncStickyNoteToDisk(n) : n;
    if (current.isWorkspaceRoot && globalActiveVaultName) {
      current = { ...current, title: globalActiveVaultName };
    }
    return current;
  });

  const allCategories = loadCategoriesFromFS();

  try {
    fs.writeFileSync(file, JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2), 'utf-8');

    // Ensure physical directory and README exist on disk for each folder and kanban collection
    const vaultPath = getVaultAbsolutePath();

    for (const n of syncedNodes) {
      if (n.isWorkspaceRoot || !n.title || !n.title.trim()) continue;
      // Resolve full nested path from the graph hierarchy (e.g. "Projects/Frontend/MyFolder")
      const nestedPath = resolveNodeNestedPath(n, syncedNodes, edges);
      if (n.type === 'folder' || n.glyph === 'Folder') {
        // Use nested path on disk — mkdirSync with nested segments creates all intermediate directories
        const folderDir = path.join(vaultPath, ...nestedPath.split('/'));
        if (!fs.existsSync(folderDir)) {
          try { fs.mkdirSync(folderDir, { recursive: true }); } catch {}
        }
        const readmePath = path.join(folderDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          try {
            fs.writeFileSync(readmePath, `# ${n.title}\nFolder created in DocuStack.\n`, 'utf-8');
          } catch {}
        }
      } else if (n.type === 'collection' || n.glyph === 'Kanban') {
        const kanbanDir = path.join(vaultPath, ...nestedPath.split('/'));
        if (!fs.existsSync(kanbanDir)) {
          try { fs.mkdirSync(kanbanDir, { recursive: true }); } catch {}
        }
        const boardId = n.collectionId || n.id;
        const boardCols = allCategories.filter((c) => c.boardId === boardId);
        const colsToEnsure = boardCols.length > 0 ? boardCols : [
          { id: 'todo', title: 'To Do' },
          { id: 'progress', title: 'In Progress' },
          { id: 'done', title: 'Done' },
        ];
        for (const col of colsToEnsure) {
          const colFolder = getSafeCloudFolderName(col.title);
          const colDir = path.join(kanbanDir, colFolder);
          if (!fs.existsSync(colDir)) {
            try { fs.mkdirSync(colDir, { recursive: true }); } catch {}
          }
        }
      }
    }
  } catch (fsErr) {
    console.warn('[workspaceFS] Local disk graph save bypassed (read-only or restricted filesystem):', fsErr);
  }

  // Sync to Cloud Storage if active
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/graph.json',
      JSON.stringify({ nodes: syncedNodes, edges, groups }, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] saveGraphToFS error:', err));

    for (const n of syncedNodes) {
      if (n.isWorkspaceRoot || !n.title || !n.title.trim()) continue;
      // Use the same nested path for cloud storage
      const nestedPath = resolveNodeNestedPath(n, syncedNodes, edges);
      if (n.type === 'folder' || n.glyph === 'Folder') {
        syncFolderNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, nestedPath)
          .catch((err) => console.warn(`[CloudStorage] syncFolderNode error for ${n.title}:`, err));
      } else if (n.type === 'collection' || n.glyph === 'Kanban') {
        const boardId = n.collectionId || n.id;
        const boardCols = allCategories.filter((c) => c.boardId === boardId);
        syncKanbanNodeToCloud(globalActiveStorageConn, globalActiveFolderPrefix, n, boardCols, nestedPath)
          .catch((err) => console.warn(`[CloudStorage] syncKanbanNode error for ${n.title}:`, err));
      }
    }
  }
}

/**
 * Atomic synchronization of entire workspace state (graph, categories, documents, folders, kanbans)
 * to both local disk filesystem and cloud storage (Backblaze B2, R2, S3, Supabase).
 */
export async function syncEntireWorkspaceToDiskAndCloud(data: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups?: GraphGroup[];
  categories: DocCategory[];
  documents: DocumentItem[];
}): Promise<{ success: boolean; cloudSynced: boolean; folderPrefix?: string; totalItems: number }> {
  ensureWorkspaceExists();

  // 1. Save Graph
  try {
    saveGraphToFS(data.nodes, data.edges, data.groups || []);
  } catch (err) {
    console.warn('[syncEntireWorkspace] Local saveGraphToFS warning:', err);
  }

  // 2. Save Categories
  try {
    saveCategoriesToFS(data.categories);
  } catch (err) {
    console.warn('[syncEntireWorkspace] Local saveCategoriesToFS warning:', err);
  }

  // 3. Save Documents
  for (const doc of data.documents) {
    try {
      saveDocumentToFS(doc);
    } catch (err) {
      console.warn(`[FS] Error saving doc ${doc.title}:`, err);
    }
  }

  // 4. Cloud Storage Full Sync
  let cloudSynced = false;
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await syncEntireWorkspaceToCloud(globalActiveStorageConn, globalActiveFolderPrefix, {
        nodes: data.nodes,
        edges: data.edges,
        groups: data.groups || [],
        categories: data.categories,
        documents: data.documents,
      });
      cloudSynced = true;
    } catch (cloudErr) {
      console.warn('[CloudStorage] syncEntireWorkspaceToCloud error:', cloudErr);
    }
  }

  return {
    success: true,
    cloudSynced,
    folderPrefix: globalActiveFolderPrefix || '',
    totalItems: data.nodes.length + data.categories.length + data.documents.length,
  };
}

// ----------------------------------------------------------------------
// PHYSICAL FILE SYSTEM TREE INSPECTOR
// ----------------------------------------------------------------------

export interface FileTreeNode {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  sizeBytes?: number;
  sizeFormatted?: string;
  modifiedAt?: string;
  children?: FileTreeNode[];
}

export function getWorkspaceFileTree(): FileTreeNode {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();

  if (!fs.existsSync(vaultPath)) {
    return {
      name: 'docustack_vault',
      relativePath: 'docustack_vault',
      absolutePath: vaultPath,
      isDirectory: true,
      children: [],
    };
  }

  function scanDir(dirPath: string, relPath = ''): FileTreeNode[] {
    if (!fs.existsSync(dirPath)) return [];
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (entry.name === '.docustack' || entry.name === '.keep') continue; // Hide internal meta directory & keep tokens from tree view

      const fullPath = path.join(dirPath, entry.name);
      const relative = path.join(relPath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          relativePath: relative,
          absolutePath: fullPath,
          isDirectory: true,
          children: scanDir(fullPath, relative),
        });
      } else {
        try {
          const stat = fs.statSync(fullPath);
          nodes.push({
            name: entry.name,
            relativePath: relative,
            absolutePath: fullPath,
            isDirectory: false,
            sizeBytes: stat.size,
            sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
            modifiedAt: stat.mtime.toISOString().split('T')[0],
          });
        } catch {}
      }
    }

    return nodes;
  }

  return {
    name: 'docustack_vault',
    relativePath: 'docustack_vault',
    absolutePath: vaultPath,
    isDirectory: true,
    children: scanDir(vaultPath),
  };
}

// ----------------------------------------------------------------------
// PHYSICAL ASSET PURGER (CASCADING PURGE)
// ----------------------------------------------------------------------

export interface PurgeAssetResult {
  success: boolean;
  purgedPath: string;
  isDirectory: boolean;
  purgedDocIds: string[];
  purgedCategoryIds: string[];
  purgedNodeIds: string[];
  message: string;
}

export async function purgeAssetFromPhysicalWorkspace(relativePath: string): Promise<PurgeAssetResult> {
  ensureWorkspaceExists();
  const cleanRel = relativePath.replace(/^\/+|\/+$/g, '');
  if (!cleanRel) {
    return {
      success: false,
      purgedPath: relativePath,
      isDirectory: false,
      purgedDocIds: [],
      purgedCategoryIds: [],
      purgedNodeIds: [],
      message: 'EMPTY_PATH',
    };
  }

  const vaultPath = getVaultAbsolutePath();
  const targetPath = path.normalize(path.join(vaultPath, cleanRel));

  let isDirectory = false;
  if (fs.existsSync(targetPath)) {
    try {
      isDirectory = fs.statSync(targetPath).isDirectory();
    } catch {}
  } else {
    const hasExt = path.extname(cleanRel).length > 0;
    isDirectory = !hasExt;
  }

  const purgedDocIds: string[] = [];
  const purgedCategoryIds: string[] = [];
  const purgedNodeIds: string[] = [];

  const currentDocs = loadDocumentsFromFS();
  let remainingDocs = [...currentDocs];

  if (isDirectory) {
    const folderPrefixWithSlash = `${cleanRel}/`;
    for (const doc of currentDocs) {
      const { fullRelativePath } = resolveDocumentStoragePath(doc);
      if (fullRelativePath.startsWith(folderPrefixWithSlash) || fullRelativePath === cleanRel) {
        purgedDocIds.push(doc.id);
      }
    }

    remainingDocs = currentDocs.filter((d) => !purgedDocIds.includes(d.id));

    try {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('[workspaceFS] Local folder rmSync warning:', e);
    }

    if (globalActiveStorageConn && globalActiveFolderPrefix) {
      try {
        await deleteCloudWorkspaceFolder(globalActiveStorageConn, globalActiveFolderPrefix, cleanRel);
      } catch (cloudErr) {
        console.warn('[CloudStorage] deleteCloudWorkspaceFolder warning:', cloudErr);
      }
    }

    const currentCategories = loadCategoriesFromFS();
    let updatedCategories = [...currentCategories];

    const currentGraph = await loadGraphFromFSAsync();
    let updatedNodes = [...currentGraph.nodes];
    let updatedEdges = [...currentGraph.edges];

    const matchingBoardNode = currentGraph.nodes.find(
      (n) =>
        (n.type === 'collection' || n.glyph === 'Kanban') &&
        (getSafeCloudFolderName(n.title) === cleanRel || n.title === cleanRel)
    );

    if (matchingBoardNode) {
      const boardId = matchingBoardNode.collectionId || matchingBoardNode.id;
      purgedNodeIds.push(matchingBoardNode.id);
      updatedNodes = updatedNodes.filter((n) => n.id !== matchingBoardNode.id);
      updatedEdges = updatedEdges.filter(
        (e) => e.source !== matchingBoardNode.id && e.target !== matchingBoardNode.id
      );

      const boardCategories = currentCategories.filter((c) => c.boardId === boardId);
      for (const cat of boardCategories) {
        purgedCategoryIds.push(cat.id);
      }
      updatedCategories = updatedCategories.filter((c) => c.boardId !== boardId);
    }

    const matchingFolderNode = currentGraph.nodes.find(
      (n) =>
        (n.type === 'folder' || n.glyph === 'Folder') &&
        (getSafeCloudFolderName(n.title) === cleanRel || n.title === cleanRel)
    );
    if (matchingFolderNode) {
      purgedNodeIds.push(matchingFolderNode.id);
      updatedNodes = updatedNodes.filter((n) => n.id !== matchingFolderNode.id);
      updatedEdges = updatedEdges.filter(
        (e) => e.source !== matchingFolderNode.id && e.target !== matchingFolderNode.id
      );
    }

    const matchingCategory = currentCategories.find((c) => {
      const safeCat = getSafeCloudFolderName(c.title);
      if (c.boardId) {
        const bNode = currentGraph.nodes.find((n) => (n.collectionId || n.id) === c.boardId);
        if (bNode) {
          const bFolder = getSafeCloudFolderName(bNode.title || 'Kanban_Board');
          return `${bFolder}/${safeCat}` === cleanRel || `${bFolder}/${c.title}` === cleanRel;
        }
      }
      return safeCat === cleanRel || c.title === cleanRel;
    });

    if (matchingCategory) {
      purgedCategoryIds.push(matchingCategory.id);
      updatedCategories = updatedCategories.filter((c) => c.id !== matchingCategory.id);
    }

    try {
      saveCategoriesToFS(updatedCategories);
    } catch {}
    try {
      await saveGraphToFSAsync(updatedNodes, updatedEdges, currentGraph.groups || []);
    } catch {}

  } else {
    for (const doc of currentDocs) {
      const { fullRelativePath } = resolveDocumentStoragePath(doc);
      if (
        fullRelativePath === cleanRel ||
        path.basename(fullRelativePath) === path.basename(cleanRel) ||
        (doc.fileUrl && (doc.fileUrl.endsWith(cleanRel) || doc.fileUrl === targetPath))
      ) {
        purgedDocIds.push(doc.id);
      }
    }

    remainingDocs = currentDocs.filter((d) => !purgedDocIds.includes(d.id));

    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch (e) {
      console.warn('[workspaceFS] Local file unlink warning:', e);
    }

    if (globalActiveStorageConn && globalActiveFolderPrefix) {
      try {
        await deleteCloudWorkspaceFile(globalActiveStorageConn, globalActiveFolderPrefix, cleanRel);
      } catch (cloudErr) {
        console.warn('[CloudStorage] deleteCloudWorkspaceFile warning:', cloudErr);
      }
    }
  }

  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remainingDocs, null, 2), 'utf-8');
  } catch {}

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json',
        JSON.stringify(remainingDocs, null, 2),
        'application/json'
      );
    } catch (cloudErr) {
      console.warn('[CloudStorage] documents_index update error:', cloudErr);
    }
  }

  return {
    success: true,
    purgedPath: cleanRel,
    isDirectory,
    purgedDocIds,
    purgedCategoryIds,
    purgedNodeIds,
    message: isDirectory
      ? `DIRECTORY "${cleanRel}" AND CASCADED ASSETS PURGED`
      : `FILE "${cleanRel}" PURGED FROM WORKSPACE`,
  };
}

// ----------------------------------------------------------------------
// WORKSPACE VAULT WALLPAPER STORAGE HANDLERS
// ----------------------------------------------------------------------

export function getRootVaultWallpaperRelativePath(): string | null {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  if (!fs.existsSync(vaultPath)) return null;

  const entries = fs.readdirSync(vaultPath);
  const wp = entries.find((f) => /^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f));
  return wp || null;
}

export function saveVaultWallpaperFile(
  buffer: Buffer,
  originalFilename: string,
  subDirRelative?: string
): { relativePath: string; url: string } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const ext = path.extname(originalFilename).toLowerCase() || '.png';

  let targetDirectory = vaultPath;
  if (subDirRelative) {
    targetDirectory = path.normalize(path.join(vaultPath, subDirRelative));
    if (!targetDirectory.startsWith(vaultPath)) {
      targetDirectory = vaultPath;
    }
  }

  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  // Purge any existing wallpaper.* file in target directory
  const existingFiles = fs.readdirSync(targetDirectory);
  for (const f of existingFiles) {
    if (/^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f) || f.startsWith('wallpaper.')) {
      try {
        fs.unlinkSync(path.join(targetDirectory, f));
      } catch {}
    }
  }

  const filename = `wallpaper${ext}`;
  const fullPath = path.join(targetDirectory, filename);
  fs.writeFileSync(fullPath, buffer);

  const relativeFromVault = path.relative(vaultPath, fullPath).replace(/\\/g, '/');
  const cacheBuster = Date.now();
  const url = `/api/wallpapers?path=${encodeURIComponent(relativeFromVault)}&t=${cacheBuster}`;

  return { relativePath: relativeFromVault, url };
}

export function deleteVaultWallpaperFile(subDirRelative?: string): boolean {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  let targetDirectory = vaultPath;
  if (subDirRelative) {
    targetDirectory = path.normalize(path.join(vaultPath, subDirRelative));
    if (!targetDirectory.startsWith(vaultPath)) {
      targetDirectory = vaultPath;
    }
  }

  if (fs.existsSync(targetDirectory)) {
    const existingFiles = fs.readdirSync(targetDirectory);
    for (const f of existingFiles) {
      if (/^wallpaper\.(webm|mp4|ogg|mov|gif|png|jpe?g|webp|svg)$/i.test(f) || f.startsWith('wallpaper.')) {
        try {
          fs.unlinkSync(path.join(targetDirectory, f));
        } catch {}
      }
    }
    return true;
  }
  return false;
}

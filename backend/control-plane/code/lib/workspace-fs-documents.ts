import fs from 'fs';
import path from 'path';
import { DocumentItem, DocCategory, GraphNode } from './types';
import { INITIAL_DOCUMENTS } from './theme';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  deleteCloudWorkspaceFile,
  deleteCloudWorkspaceFolder,
  deleteCloudNodeAssets,
  getSafeCloudFolderName,
} from './cloud-storage-service';
import {
  ensureWorkspaceExists,
  getVaultAbsolutePath,
  globalActiveStorageConn,
  globalActiveFolderPrefix,
} from './workspace-fs-core';
import { loadCategoriesFromFS } from './workspace-fs-categories';

// ----------------------------------------------------------------------
// DOCUMENTS FS HANDLERS
// ----------------------------------------------------------------------

function getNodesQuick(): GraphNode[] {
  try {
    const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
    const file = path.join(metaDir, 'graph.json');
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return parsed.nodes || [];
    }
  } catch {}
  return [];
}

export function loadDocumentsFromFS(): DocumentItem[] {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  if (!fs.existsSync(indexFile)) {
    return INITIAL_DOCUMENTS;
  }

  try {
    const raw = fs.readFileSync(indexFile, 'utf-8');
    const docs: DocumentItem[] = JSON.parse(raw);

    // Verify each doc's physical file on disk and re-read actual content
    return docs.map((doc) => {
      if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
        try {
          const diskContent = fs.readFileSync(doc.fileUrl, 'utf-8');
          const stat = fs.statSync(doc.fileUrl);
          return {
            ...doc,
            content: diskContent,
            fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
          };
        } catch {
          return doc;
        }
      }
      return doc;
    });
  } catch (err) {
    console.error('Error reading documents index from FS:', err);
    return INITIAL_DOCUMENTS;
  }
}

export async function loadDocumentsFromFSAsync(): Promise<DocumentItem[]> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json'
      );
      if (cloudRaw) {
        const cloudDocs: DocumentItem[] = JSON.parse(cloudRaw);
        if (Array.isArray(cloudDocs) && cloudDocs.length > 0) {
          try {
            fs.writeFileSync(indexFile, cloudRaw, 'utf-8');
          } catch {}
          return cloudDocs;
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadDocumentsFromFSAsync fallback:', e);
    }
  }

  return loadDocumentsFromFS();
}

/**
 * Dynamically resolves the physical directory and full relative path for a document
 * based on the user's actual Kanban boards, categories (columns), and folder nodes.
 */
export function resolveDocumentStoragePath(
  doc: DocumentItem,
  categories?: DocCategory[],
  nodes?: GraphNode[]
): { folderPath: string; fullRelativePath: string; fileName: string } {
  const currentCategories = categories || loadCategoriesFromFS();
  const currentNodes = nodes || getNodesQuick();

  let folderPath = '';
  const assignedCat = currentCategories.find((c) => c.id === doc.categoryId);

  if (assignedCat) {
    const catFolder = getSafeCloudFolderName(assignedCat.title);
    if (assignedCat.boardId) {
      const boardNode = currentNodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
      const boardFolder = getSafeCloudFolderName(boardNode?.title || 'Kanban_Board');
      folderPath = `${boardFolder}/${catFolder}`;
    } else {
      folderPath = catFolder;
    }
  } else if (doc.categoryId) {
    const folderNode = currentNodes.find(
      (n) => n.id === doc.categoryId || n.title === doc.categoryId
    );
    if (folderNode) {
      folderPath = getSafeCloudFolderName(folderNode.title);
    }
  }

  const safeFileName = (doc.title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .concat(doc.title && doc.title.includes('.') ? '' : '.md');

  const fullRelativePath = folderPath ? `${folderPath}/${safeFileName}` : safeFileName;

  return { folderPath, fullRelativePath, fileName: safeFileName };
}

export async function saveDocumentToFSAsync(doc: DocumentItem): Promise<DocumentItem> {
  const updatedDoc = saveDocumentToFS(doc);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const { fullRelativePath } = resolveDocumentStoragePath(doc);
    const fileContent = doc.content || '# ' + doc.title;
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        fullRelativePath,
        fileContent,
        doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
      );
      const currentDocs = loadDocumentsFromFS();
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/documents_index.json',
        JSON.stringify(currentDocs, null, 2),
        'application/json'
      );
    } catch (err) {
      console.warn('[CloudStorage] saveDocumentToFSAsync error:', err);
    }
  }

  return updatedDoc;
}

export function saveDocumentToFS(doc: DocumentItem): DocumentItem {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  const currentDocs = loadDocumentsFromFS();
  const existingIndex = currentDocs.findIndex((d) => d.id === doc.id);
  const existingDoc = existingIndex >= 0 ? currentDocs[existingIndex] : undefined;

  const { folderPath, fullRelativePath } = resolveDocumentStoragePath(doc);
  const physicalPath = path.join(vaultPath, fullRelativePath);

  let fileSizeFormatted = doc.fileSize || '1.0 KB';

  try {
    const targetDir = folderPath ? path.join(vaultPath, folderPath) : vaultPath;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // If document moved between categories/folders, unlink old physical path
    if (existingDoc?.fileUrl && existingDoc.fileUrl !== physicalPath && fs.existsSync(existingDoc.fileUrl)) {
      try {
        fs.unlinkSync(existingDoc.fileUrl);
      } catch {}
    }

    // Write content directly to physical disk file
    fs.writeFileSync(physicalPath, doc.content || '# ' + doc.title, 'utf-8');
    const stat = fs.statSync(physicalPath);
    fileSizeFormatted = `${(stat.size / 1024).toFixed(1)} KB`;
  } catch (fsErr) {
    console.warn('[workspaceFS] Local document disk write bypassed (read-only filesystem):', fsErr);
  }

  const updatedDoc: DocumentItem = {
    ...doc,
    fileUrl: physicalPath,
    fileSize: fileSizeFormatted,
  };

  let updatedDocsList: DocumentItem[];
  if (existingIndex >= 0) {
    updatedDocsList = [...currentDocs];
    updatedDocsList[existingIndex] = updatedDoc;
  } else {
    updatedDocsList = [updatedDoc, ...currentDocs];
  }

  try {
    fs.writeFileSync(indexFile, JSON.stringify(updatedDocsList, null, 2), 'utf-8');
  } catch {}

  // Sync directly to Cloud Storage (Backblaze B2, R2, S3, Supabase) if active
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    const fileContent = doc.content || '# ' + doc.title;
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      fullRelativePath,
      fileContent,
      doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
    ).catch((err) => console.warn('[CloudStorage] write file error:', err));

    // If file moved in cloud storage, remove old cloud object
    if (existingDoc) {
      const oldResolved = resolveDocumentStoragePath(existingDoc);
      if (oldResolved.fullRelativePath !== fullRelativePath) {
        deleteCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          oldResolved.fullRelativePath
        ).catch(() => {});
      }
    }

    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/documents_index.json',
      JSON.stringify(updatedDocsList, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] index update error:', err));
  }

  return updatedDoc;
}

export function deleteDocumentFromFS(docId: string): boolean {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const indexFile = path.join(metaDir, 'documents_index.json');

  const currentDocs = loadDocumentsFromFS();
  const target = currentDocs.find((d) => d.id === docId);

  if (target && target.fileUrl && fs.existsSync(target.fileUrl)) {
    try {
      fs.unlinkSync(target.fileUrl);
    } catch (e) {
      console.warn('Could not delete physical file from disk:', e);
    }
  }

  const remaining = currentDocs.filter((d) => d.id !== docId);
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remaining, null, 2), 'utf-8');
  } catch {}

  // Sync deletion to Cloud Storage if active
  if (globalActiveStorageConn && globalActiveFolderPrefix && target) {
    const { fullRelativePath } = resolveDocumentStoragePath(target);

    deleteCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      fullRelativePath
    ).catch((err) => console.warn('[CloudStorage] delete file error:', err));

    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/documents_index.json',
      JSON.stringify(remaining, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] delete index update error:', err));
  }

  return true;
}

export function deleteCategoryAndDocumentsFromFS(categoryId: string): { purgedDocsCount: number; purgedCategory: boolean } {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const catFile = path.join(metaDir, 'categories.json');
  const indexFile = path.join(metaDir, 'documents_index.json');

  // 1. Remove category from categories.json
  const currentCategories = loadCategoriesFromFS();
  const remainingCategories = currentCategories.filter((c) => c.id !== categoryId);
  try {
    fs.writeFileSync(catFile, JSON.stringify(remainingCategories, null, 2), 'utf-8');
  } catch {}

  // 2. Remove all documents matching categoryId from documents_index.json and unlink physical files
  const currentDocs = loadDocumentsFromFS();
  const docsToDelete = currentDocs.filter((d) => d.categoryId === categoryId);
  for (const doc of docsToDelete) {
    if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
      try {
        fs.unlinkSync(doc.fileUrl);
      } catch (e) {
        console.warn('Could not delete physical file for doc:', doc.id, e);
      }
    }
  }

  const remainingDocs = currentDocs.filter((d) => d.categoryId !== categoryId);
  try {
    fs.writeFileSync(indexFile, JSON.stringify(remainingDocs, null, 2), 'utf-8');
  } catch {}

  return { purgedDocsCount: docsToDelete.length, purgedCategory: true };
}

export async function deleteCategoryAndDocumentsFromFSAsync(
  categoryId: string
): Promise<{ purgedDocsCount: number; purgedCategory: boolean; purgedPaths: string[] }> {
  const currentCategories = loadCategoriesFromFS();
  const targetCat = currentCategories.find((c) => c.id === categoryId);
  const result = deleteCategoryAndDocumentsFromFS(categoryId);
  const purgedPaths: string[] = [];

  if (targetCat) {
    const catFolder = getSafeCloudFolderName(targetCat.title);
    purgedPaths.push(catFolder);

    // If cloud storage active, delete cloud folder and update indices
    if (globalActiveStorageConn && globalActiveFolderPrefix) {
      try {
        await deleteCloudWorkspaceFolder(globalActiveStorageConn, globalActiveFolderPrefix, catFolder);

        const remainingCats = loadCategoriesFromFS();
        const remainingDocs = loadDocumentsFromFS();

        await writeCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          '.docustack/categories.json',
          JSON.stringify(remainingCats, null, 2),
          'application/json'
        );

        await writeCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          '.docustack/documents_index.json',
          JSON.stringify(remainingDocs, null, 2),
          'application/json'
        );
      } catch (cloudErr) {
        console.warn('[CloudStorage] Error deleting category from cloud:', cloudErr);
      }
    }

    // Unlink physical directory on local vault if present
    const vaultPath = getVaultAbsolutePath();
    try {
      const dirOnDisk = path.join(vaultPath, catFolder);
      if (fs.existsSync(dirOnDisk)) {
        fs.rmSync(dirOnDisk, { recursive: true, force: true });
      }
    } catch {}
  }

  return { ...result, purgedPaths };
}

/**
 * Universally delete all cloud and physical assets for a graph node
 * (e.g. folder nodes, Kanban board folders, sticky notes)
 */
export async function deleteNodeAssetsAsync(
  node: GraphNode,
  categories: DocCategory[] = []
): Promise<{ success: boolean; purgedPaths: string[] }> {
  const purgedPaths: string[] = [];
  if (node.isWorkspaceRoot) return { success: false, purgedPaths };

  const safeTitle = getSafeCloudFolderName(node.title);

  // 1. If cloud storage active, delete from cloud
  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRes = await deleteCloudNodeAssets(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        node,
        categories
      );
      purgedPaths.push(...cloudRes.purgedPaths);
    } catch (err) {
      console.warn(`[CloudStorage] Error deleting node ${node.title} from cloud:`, err);
    }
  }

  // 2. Unlink from local vault disk if directory/file exists
  const vaultPath = getVaultAbsolutePath();
  try {
    if (node.type === 'folder' || node.glyph === 'Folder' || node.type === 'collection' || node.glyph === 'Kanban') {
      const dirOnDisk = path.join(vaultPath, safeTitle);
      if (fs.existsSync(dirOnDisk)) {
        fs.rmSync(dirOnDisk, { recursive: true, force: true });
        if (!purgedPaths.includes(safeTitle)) purgedPaths.push(safeTitle);
      }
    } else if (node.type === 'sticky') {
      const fileName = `${(node.title || 'sticky').toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}.txt`;
      const fileOnDisk = path.join(vaultPath, fileName);
      if (fs.existsSync(fileOnDisk)) {
        fs.unlinkSync(fileOnDisk);
        if (!purgedPaths.includes(fileName)) purgedPaths.push(fileName);
      }
    }
  } catch (e) {
    console.warn(`[workspaceFS] Error unlinking node assets for ${node.title}:`, e);
  }

  return { success: true, purgedPaths };
}

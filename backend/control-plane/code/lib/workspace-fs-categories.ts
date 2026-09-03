import fs from 'fs';
import path from 'path';
import { DocCategory, GraphNode } from './types';
import { INITIAL_CATEGORIES } from './theme';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  getSafeCloudFolderName,
} from './cloud-storage-service';
import {
  ensureWorkspaceExists,
  getVaultAbsolutePath,
  globalActiveStorageConn,
  globalActiveFolderPrefix,
} from './workspace-fs-core';

// ----------------------------------------------------------------------
// CATEGORIES FS HANDLERS
// ----------------------------------------------------------------------

function getBoardNodesQuick(): { id: string; collectionId?: string; title: string }[] {
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

export function loadCategoriesFromFS(): DocCategory[] {
  ensureWorkspaceExists();
  const metaDir = path.join(getVaultAbsolutePath(), '.docustack');
  const file = path.join(metaDir, 'categories.json');

  if (!fs.existsSync(file)) return INITIAL_CATEGORIES;

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return INITIAL_CATEGORIES;
  }
}

export async function loadCategoriesFromFSAsync(): Promise<DocCategory[]> {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'categories.json');

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      const cloudRaw = await readCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/categories.json'
      );
      if (cloudRaw) {
        const cloudCats: DocCategory[] = JSON.parse(cloudRaw);
        if (Array.isArray(cloudCats) && cloudCats.length > 0) {
          try {
            fs.writeFileSync(file, cloudRaw, 'utf-8');
          } catch {}
          return cloudCats;
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] loadCategoriesFromFSAsync fallback:', e);
    }
  }

  return loadCategoriesFromFS();
}

export async function saveCategoriesToFSAsync(categories: DocCategory[]): Promise<void> {
  saveCategoriesToFS(categories);

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    try {
      await writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        '.docustack/categories.json',
        JSON.stringify(categories, null, 2),
        'application/json'
      );

      const allNodes = getBoardNodesQuick();
      for (const cat of categories) {
        const safeCat = getSafeCloudFolderName(cat.title);
        let catRelPath = safeCat;
        if (cat.boardId) {
          const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
          if (boardNode) {
            const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
            catRelPath = `${boardFolder}/${safeCat}`;
          }
        }
        await writeCloudWorkspaceFile(
          globalActiveStorageConn,
          globalActiveFolderPrefix,
          `${catRelPath}/.keep`,
          '',
          'text/plain'
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('[CloudStorage] saveCategoriesToFSAsync error:', err);
    }
  }
}

export function saveCategoriesToFS(categories: DocCategory[]) {
  ensureWorkspaceExists();
  const vaultPath = getVaultAbsolutePath();
  const metaDir = path.join(vaultPath, '.docustack');
  const file = path.join(metaDir, 'categories.json');

  const allNodes = getBoardNodesQuick();

  try {
    fs.writeFileSync(file, JSON.stringify(categories, null, 2), 'utf-8');

    // Ensure category subfolders exist on physical disk
    for (const cat of categories) {
      const safeCat = getSafeCloudFolderName(cat.title);
      let catRelPath = safeCat;
      if (cat.boardId) {
        const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
        if (boardNode) {
          const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
          catRelPath = `${boardFolder}/${safeCat}`;
        }
      }
      const catDir = path.join(vaultPath, catRelPath);
      if (!fs.existsSync(catDir)) {
        try { fs.mkdirSync(catDir, { recursive: true }); } catch {}
      }
    }
  } catch (fsErr) {
    console.warn('[workspaceFS] Local disk categories save bypassed (read-only filesystem):', fsErr);
  }

  if (globalActiveStorageConn && globalActiveFolderPrefix) {
    writeCloudWorkspaceFile(
      globalActiveStorageConn,
      globalActiveFolderPrefix,
      '.docustack/categories.json',
      JSON.stringify(categories, null, 2),
      'application/json'
    ).catch((err) => console.warn('[CloudStorage] saveCategories error:', err));

    for (const cat of categories) {
      const safeCat = getSafeCloudFolderName(cat.title);
      let catRelPath = safeCat;
      if (cat.boardId) {
        const boardNode = allNodes.find((n) => (n.collectionId || n.id) === cat.boardId);
        if (boardNode) {
          const boardFolder = getSafeCloudFolderName(boardNode.title || 'Kanban_Board');
          catRelPath = `${boardFolder}/${safeCat}`;
        }
      }
      writeCloudWorkspaceFile(
        globalActiveStorageConn,
        globalActiveFolderPrefix,
        `${catRelPath}/.keep`,
        '',
        'text/plain'
      ).catch(() => {});
    }
  }
}

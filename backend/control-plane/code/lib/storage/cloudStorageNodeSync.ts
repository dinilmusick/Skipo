/**
 * @file cloudStorageNodeSync.ts
 * @description Graph node synchronization, cloud asset deletion, and workspace bucket initialization.
 * File size strictly <= 200 lines.
 */

import { UserStorageConnection, GraphNode, DocCategory } from '../types';
import { getInitialWorkspaceFiles } from '../workspace-canonical';
import {
  writeCloudWorkspaceFile,
  readCloudWorkspaceFile,
  deleteCloudWorkspaceFile,
  ensureCloudDirectoryMarker,
} from './cloudStorageCore';
import { deleteCloudWorkspaceFolder } from './cloudStoragePermanentDelete';

export function getSafeCloudFolderName(rawTitle: string): string {
  const sanitized = (rawTitle || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_');
  return sanitized || 'folder';
}

export async function deleteCloudNodeAssets(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  categories: DocCategory[] = [],
  nestedPath?: string
): Promise<{ success: boolean; purgedPaths: string[] }> {
  const purgedPaths: string[] = [];
  if (!conn || !folderPrefix || node.isWorkspaceRoot) return { success: false, purgedPaths };

  const safeTitle = getSafeCloudFolderName(node.title);
  const targetFolder = nestedPath || safeTitle;

  if (node.type === 'collection' || node.glyph === 'Kanban') {
    const boardId = node.collectionId || node.id;
    const cols = categories.filter((c) => c.boardId === boardId);

    for (const col of cols) {
      const colTitle = getSafeCloudFolderName(col.title);
      await deleteCloudWorkspaceFolder(conn, folderPrefix, `${targetFolder}/${colTitle}`);
      purgedPaths.push(`${targetFolder}/${colTitle}`);
      if (targetFolder !== safeTitle) await deleteCloudWorkspaceFolder(conn, folderPrefix, `${safeTitle}/${colTitle}`);
      await deleteCloudWorkspaceFolder(conn, folderPrefix, colTitle);
      purgedPaths.push(colTitle);
    }

    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/kanban_board.json`);
    if (targetFolder !== safeTitle) await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/kanban_board.json`);

    await deleteCloudWorkspaceFolder(conn, folderPrefix, targetFolder);
    purgedPaths.push(targetFolder);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFolder(conn, folderPrefix, safeTitle);
      purgedPaths.push(safeTitle);
    }
  } else if (node.type === 'folder' || node.glyph === 'Folder') {
    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/.keep`);
    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/README.md`);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/.keep`);
      await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/README.md`);
    }

    await deleteCloudWorkspaceFolder(conn, folderPrefix, targetFolder);
    purgedPaths.push(targetFolder);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFolder(conn, folderPrefix, safeTitle);
      purgedPaths.push(safeTitle);
    }
  } else if (node.type === 'sticky') {
    const fileName = `${(node.title || 'sticky').toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}.txt`;
    await deleteCloudWorkspaceFile(conn, folderPrefix, fileName);
    purgedPaths.push(fileName);
  }

  return { success: true, purgedPaths };
}

export async function purgeDefaultCloudWorkspaceAssets(
  conn: UserStorageConnection,
  folderPrefix: string
): Promise<void> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!cleanPrefix) return;

  try {
    await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'Core_Kanban');
    await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'core_kanban');

    const graphContent = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json');
    if (graphContent) {
      const graph = JSON.parse(graphContent);
      let modified = false;
      if (Array.isArray(graph.nodes)) {
        const filtered = graph.nodes.filter(
          (n: any) => n.id !== 'node-core-kanban' && n.collectionId !== 'kanban-main' && n.title !== 'Core_Kanban'
        );
        if (filtered.length !== graph.nodes.length) {
          graph.nodes = filtered;
          modified = true;
        }
      }
      if (Array.isArray(graph.edges)) {
        const filteredEdges = graph.edges.filter((e: any) => e.source !== 'node-core-kanban' && e.target !== 'node-core-kanban');
        if (filteredEdges.length !== graph.edges.length) {
          graph.edges = filteredEdges;
          modified = true;
        }
      }
      if (modified) {
        await writeCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json', JSON.stringify(graph, null, 2), 'application/json');
      }
    }
  } catch {}
}

export async function initializeCloudWorkspaceBucket(
  conn: UserStorageConnection,
  folderPrefix: string,
  workspaceName: string,
  userName: string = 'User'
): Promise<{ success: boolean; filesCreated: string[] }> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const filesCreated: string[] = [];

  await ensureCloudDirectoryMarker(conn, cleanPrefix);

  try {
    const existing = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json');
    if (existing && existing.trim().length > 0) {
      await purgeDefaultCloudWorkspaceAssets(conn, cleanPrefix);
      return { success: true, filesCreated: [] };
    }
  } catch {}

  const initialFiles = getInitialWorkspaceFiles(workspaceName, cleanPrefix, userName, conn.provider);
  for (const [relPath, content] of Object.entries(initialFiles)) {
    await writeCloudWorkspaceFile(conn, cleanPrefix, relPath, content, 'application/json');
    filesCreated.push(relPath);
  }

  await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'Core_Kanban');
  await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'core_kanban');
  return { success: true, filesCreated };
}

export async function syncFolderNodeToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  nestedPath?: string
): Promise<void> {
  const folderName = nestedPath || getSafeCloudFolderName(node.title || 'Folder');
  const readme = `# ${node.title || 'Folder'}\n\nFolder created in DocuStack Workspace.\n- Created: ${new Date().toISOString()}\n`;
  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/.keep`, '', 'text/plain');
  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/README.md`, readme, 'text/markdown');
}

export async function syncKanbanNodeToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  columns: DocCategory[] = [],
  nestedPath?: string
): Promise<void> {
  const boardFolder = nestedPath || getSafeCloudFolderName(node.title || 'Kanban_Board');
  await ensureCloudDirectoryMarker(conn, `${folderPrefix}/${boardFolder}`);
  const boardManifest = {
    id: node.collectionId || node.id,
    title: node.title || 'Kanban Board',
    glyph: node.glyph || 'Kanban',
    color: node.color || '#D4AF37',
    tags: node.tags || ['Kanban'],
    columns: columns.map((c) => ({ id: c.id, title: c.title, glyph: c.glyph, color: c.color, description: c.description })),
    updatedAt: new Date().toISOString(),
  };
  await writeCloudWorkspaceFile(conn, folderPrefix, `${boardFolder}/kanban_board.json`, JSON.stringify(boardManifest, null, 2), 'application/json');
}

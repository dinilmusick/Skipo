import { UserStorageConnection, GraphNode, GraphEdge, GraphGroup, DocCategory, DocumentItem } from '../types';
import { writeCloudWorkspaceFile } from './cloudStorageCore';
import { resolveNodeNestedPath } from '../workspace-canonical';
import { syncFolderNodeToCloud, syncKanbanNodeToCloud, getSafeCloudFolderName } from './cloudStorageNodeSync';
import { reconcileCloudWorkspaceOrphans } from './cloudStorageReconciliation';

/**
 * Sync entire workspace state (graph, categories, documents, folders, and kanban boards) to Cloud Storage
 */
export async function syncEntireWorkspaceToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    groups: GraphGroup[];
    categories: DocCategory[];
    documents: DocumentItem[];
  }
): Promise<{ success: boolean; syncedCount: number }> {
  let syncedCount = 0;

  // 1. Graph State
  await writeCloudWorkspaceFile(
    conn,
    folderPrefix,
    '.docustack/graph.json',
    JSON.stringify({ nodes: data.nodes, edges: data.edges, groups: data.groups }, null, 2),
    'application/json'
  );
  syncedCount++;

  // 2. Categories State
  await writeCloudWorkspaceFile(
    conn,
    folderPrefix,
    '.docustack/categories.json',
    JSON.stringify(data.categories, null, 2),
    'application/json'
  );
  syncedCount++;

  // 3. Documents Index
  await writeCloudWorkspaceFile(
    conn,
    folderPrefix,
    '.docustack/documents_index.json',
    JSON.stringify(data.documents, null, 2),
    'application/json'
  );
  syncedCount++;

  // 4. Physical Folder & Kanban Nodes Sync (Nested)
  for (const node of data.nodes) {
    if (node.isWorkspaceRoot || !node.title || !node.title.trim()) continue;
    const nestedPath = resolveNodeNestedPath(node, data.nodes, data.edges);
    if (node.type === 'folder' || node.glyph === 'Folder') {
      try {
        await syncFolderNodeToCloud(conn, folderPrefix, node, nestedPath);
        syncedCount++;
      } catch (err) {
        console.warn(`[CloudStorage] Error syncing folder node ${node.title}:`, err);
      }
    } else if (node.type === 'collection' || node.glyph === 'Kanban') {
      try {
        const boardId = node.collectionId || node.id;
        const boardCols = data.categories.filter((c) => c.boardId === boardId);
        await syncKanbanNodeToCloud(conn, folderPrefix, node, boardCols, nestedPath);
        syncedCount++;
      } catch (err) {
        console.warn(`[CloudStorage] Error syncing kanban node ${node.title}:`, err);
      }
    }
  }

  // 5. Individual Document Physical Markdown Files (Nested)
  for (const doc of data.documents) {
    try {
      const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;

      const assignedCat = data.categories.find((c) => c.id === doc.categoryId);
      let targetPath = `inbox/${filename}`;

      if (assignedCat) {
        const catFolder = getSafeCloudFolderName(assignedCat.title);
        if (assignedCat.boardId) {
          const boardNode = data.nodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
          const boardPath = boardNode ? resolveNodeNestedPath(boardNode, data.nodes, data.edges) : 'Kanban';
          targetPath = `${boardPath}/${catFolder}/${filename}`;
        } else {
          targetPath = `${catFolder}/${filename}`;
        }
      } else if (doc.categoryId) {
        const folderNode = data.nodes.find((n) => n.id === doc.categoryId || n.title === doc.categoryId);
        if (folderNode) {
          const folderPath = resolveNodeNestedPath(folderNode, data.nodes, data.edges);
          targetPath = `${folderPath}/${filename}`;
        }
      }

      await writeCloudWorkspaceFile(
        conn,
        folderPrefix,
        targetPath,
        doc.content || `# ${doc.title}`,
        doc.fileType === 'code' ? 'text/markdown' : 'text/plain'
      );
      syncedCount++;
    } catch (err) {
      console.warn(`[CloudStorage] Error writing document ${doc.title}:`, err);
    }
  }

  // 6. Reconcile / Prune Orphaned Objects from Cloud Bucket
  await reconcileCloudWorkspaceOrphans(conn, folderPrefix, data);

  return { success: true, syncedCount };
}

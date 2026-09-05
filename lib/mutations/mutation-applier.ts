import { WorkspaceMutation, MutationResult } from './mutation-types';
import {
  loadGraphFromFSAsync,
  saveGraphToFSAsync,
  loadDocumentsFromFSAsync,
  saveDocumentToFSAsync,
  deleteDocumentFromFS,
  loadCategoriesFromFSAsync,
  saveCategoriesToFSAsync,
} from '../workspaceFS';
import { GraphNode, GraphEdge, GraphGroup, DocumentItem, DocCategory } from '../types';

// In-memory workspace revisions map: workspaceId -> revision number
const workspaceRevisions = new Map<string, number>();

export function getWorkspaceRevision(workspaceId: string): number {
  return workspaceRevisions.get(workspaceId) || 1;
}

export function setWorkspaceRevision(workspaceId: string, rev: number): void {
  workspaceRevisions.set(workspaceId, rev);
}

export async function applyWorkspaceMutations(
  workspaceId: string,
  baseRevision: number,
  mutations: WorkspaceMutation[]
): Promise<MutationResult> {
  const currentRev = getWorkspaceRevision(workspaceId);

  // Optimistic concurrency verification
  if (baseRevision > 0 && baseRevision < currentRev) {
    return {
      success: false,
      newRevision: currentRev,
      appliedMutationIds: [],
      affectedEntities: [],
      conflict: {
        currentRevision: currentRev,
        message: `CONCURRENCY_CONFLICT: baseRevision ${baseRevision} is stale (current: ${currentRev})`,
      },
    };
  }

  const appliedMutationIds: string[] = [];
  const affectedEntities: MutationResult['affectedEntities'] = [];

  // Group mutations by domain
  const graphMutations = mutations.filter((m) => ['node', 'edge', 'group'].includes(m.entity));
  const docMutations = mutations.filter((m) => m.entity === 'document');
  const catMutations = mutations.filter((m) => m.entity === 'category');

  // 1. Process Graph mutations
  if (graphMutations.length > 0) {
    const graph = await loadGraphFromFSAsync();
    let nodes: GraphNode[] = [...graph.nodes];
    let edges: GraphEdge[] = [...graph.edges];
    let groups: GraphGroup[] = [...graph.groups];

    for (const m of graphMutations) {
      if (m.entity === 'node') {
        if (m.operation === 'create') {
          nodes.push({ id: m.entityId, ...m.patch } as GraphNode);
        } else if (m.operation === 'update' || m.operation === 'move') {
          nodes = nodes.map((n) => (n.id === m.entityId ? { ...n, ...m.patch } : n));
        } else if (m.operation === 'delete') {
          nodes = nodes.filter((n) => n.id !== m.entityId);
        }
      } else if (m.entity === 'edge') {
        if (m.operation === 'create') {
          edges.push({ id: m.entityId, ...m.patch } as GraphEdge);
        } else if (m.operation === 'delete') {
          edges = edges.filter((e) => e.id !== m.entityId);
        }
      } else if (m.entity === 'group') {
        if (m.operation === 'create') {
          groups.push({ id: m.entityId, ...m.patch } as GraphGroup);
        } else if (m.operation === 'update' || m.operation === 'move') {
          groups = groups.map((g) => (g.id === m.entityId ? { ...g, ...m.patch } : g));
        } else if (m.operation === 'delete') {
          groups = groups.filter((g) => g.id !== m.entityId);
        }
      }
      appliedMutationIds.push(m.mutationId);
      affectedEntities.push({ entity: m.entity, entityId: m.entityId, operation: m.operation });
    }

    await saveGraphToFSAsync(nodes, edges, groups);
  }

  // 2. Process Document mutations
  if (docMutations.length > 0) {
    for (const m of docMutations) {
      if (m.operation === 'create' || m.operation === 'update') {
        await saveDocumentToFSAsync({ id: m.entityId, ...m.patch } as DocumentItem);
      } else if (m.operation === 'delete') {
        deleteDocumentFromFS(m.entityId);
      }
      appliedMutationIds.push(m.mutationId);
      affectedEntities.push({ entity: m.entity, entityId: m.entityId, operation: m.operation });
    }
  }

  // 3. Process Category mutations
  if (catMutations.length > 0) {
    let cats = await loadCategoriesFromFSAsync();
    for (const m of catMutations) {
      if (m.operation === 'create') {
        cats.push({ id: m.entityId, ...m.patch } as DocCategory);
      } else if (m.operation === 'update') {
        cats = cats.map((c) => (c.id === m.entityId ? { ...c, ...m.patch } : c));
      } else if (m.operation === 'delete') {
        cats = cats.filter((c) => c.id !== m.entityId);
      }
      appliedMutationIds.push(m.mutationId);
      affectedEntities.push({ entity: m.entity, entityId: m.entityId, operation: m.operation });
    }
    await saveCategoriesToFSAsync(cats);
  }

  const newRevision = currentRev + 1;
  setWorkspaceRevision(workspaceId, newRevision);

  return {
    success: true,
    newRevision,
    appliedMutationIds,
    affectedEntities,
  };
}

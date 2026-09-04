import { NextRequest, NextResponse } from 'next/server';
import {
  loadGraphFromFS,
  saveGraphToFS,
  loadGraphFromFSAsync,
  saveGraphToFSAsync,
  loadCategoriesFromFS,
  deleteCategoryAndDocumentsFromFSAsync,
  deleteNodeAssetsAsync,
  resolveNodeNestedPath,
} from '@/lib/workspaceFS';
import { extractTagsFromText } from '@/lib/tag-extractor';
import { GraphNode } from '@/lib/types';
import { resolveRequestContextVault } from '@/lib/auth-storage';

export async function GET(req: NextRequest) {
  await resolveRequestContextVault(req);
  const graph = await loadGraphFromFSAsync();
  return NextResponse.json({
    success: true,
    nodes: graph.nodes,
    edges: graph.edges,
    groups: graph.groups || [],
    timestamp: Date.now(),
    storageType: 'PHYSICAL_FILE_SYSTEM_VAULT',
  });
}

export async function POST(req: NextRequest) {
  try {
    await resolveRequestContextVault(req);
    const payload = await req.json();
    const { action } = payload;
    const { nodes: currentNodes, edges: currentEdges, groups: currentGroups } = await loadGraphFromFSAsync();

    if (action === 'ADD_NODE') {
      const { node, edge } = payload;
      if (!node) return NextResponse.json({ success: false, error: 'MISSING_NODE' }, { status: 400 });

      // Automatically generate tags for nodes (Kanban and Subfolders) using wink-nlp
      const nodeText = `${node.title || ''} ${node.content || ''}`;
      const autoTags = extractTagsFromText(nodeText, 4);
      const combinedTags = Array.from(new Set([...(node.tags || []), ...autoTags]));

      const enrichedNode: GraphNode = {
        ...node,
        tags: combinedTags,
      };

      const newNodes = [...currentNodes, enrichedNode];
      const newEdges = edge ? [...currentEdges, edge] : currentEdges;

      await saveGraphToFSAsync(newNodes, newEdges, currentGroups);
      return NextResponse.json({ success: true, node: enrichedNode, edge }, { status: 201 });
    }

    if (action === 'UPDATE_NODE') {
      const { node } = payload;
      if (!node?.id) return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });

      const updatedNodes = currentNodes.map((n) => {
        if (n.id === node.id) {
          const merged = { ...n, ...node };
          if (node.tags !== undefined && Array.isArray(node.tags)) {
            return { ...merged, tags: node.tags };
          }
          const nodeText = `${merged.title || ''} ${merged.content || ''}`;
          const autoTags = extractTagsFromText(nodeText, 4);
          const combinedTags = Array.from(new Set([...(merged.tags || []), ...autoTags]));
          return { ...merged, tags: combinedTags };
        }
        return n;
      });

      await saveGraphToFSAsync(updatedNodes, currentEdges, currentGroups);

      const target = updatedNodes.find((n) => n.id === node.id);
      return NextResponse.json({ success: true, node: target });
    }

    if (action === 'DELETE_NODE') {
      const { id } = payload;
      if (!id) return NextResponse.json({ success: false, error: 'MISSING_ID' }, { status: 400 });

      // Find all descendant nodes if deleting a branch/folder
      const toDeleteNodeIds = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const edge of currentEdges) {
          if (toDeleteNodeIds.has(edge.source) && !toDeleteNodeIds.has(edge.target)) {
            toDeleteNodeIds.add(edge.target);
            changed = true;
          }
        }
      }

      // Calculate depth of each node in the tree to delete deepest leaf nodes FIRST (bottom-up deletion sequence)
      const depthMap = new Map<string, number>();
      function getNodeDepth(nid: string, visited = new Set<string>()): number {
        if (visited.has(nid)) return 0;
        visited.add(nid);
        const parentEdge = currentEdges.find((e) => e.target === nid);
        if (!parentEdge || !parentEdge.source) return 0;
        return 1 + getNodeDepth(parentEdge.source, visited);
      }
      for (const nid of toDeleteNodeIds) {
        depthMap.set(nid, getNodeDepth(nid));
      }

      // Sort descending by depth: leaf/child nodes first, parent folder last
      const orderedNodeIds = Array.from(toDeleteNodeIds).sort(
        (a, b) => (depthMap.get(b) || 0) - (depthMap.get(a) || 0)
      );

      const allCategories = loadCategoriesFromFS();
      const allPurgedPaths: string[] = [];

      // Purge all node assets bottom-up: contents inside first, upper folder last
      for (const nid of orderedNodeIds) {
        const targetNode = currentNodes.find((n) => n.id === nid);
        if (targetNode && !targetNode.isWorkspaceRoot) {
          const nestedPath = resolveNodeNestedPath(targetNode, currentNodes, currentEdges);

          // 1. If collection, purge its documents and categories inside FIRST
          if (targetNode.type === 'collection' || targetNode.collectionId) {
            const catId = targetNode.collectionId || targetNode.id;
            const catRes = await deleteCategoryAndDocumentsFromFSAsync(catId);
            allPurgedPaths.push(...catRes.purgedPaths);
          }

          // 2. Now delete the node folder and assets (contents inside first, upper layer folder last)
          const res = await deleteNodeAssetsAsync(targetNode, allCategories, nestedPath);
          allPurgedPaths.push(...res.purgedPaths);
          if (nestedPath) allPurgedPaths.push(nestedPath);
        }
      }

      const newNodes = currentNodes.filter((n) => !toDeleteNodeIds.has(n.id));
      const newEdges = currentEdges.filter(
        (e) => !toDeleteNodeIds.has(e.source) && !toDeleteNodeIds.has(e.target)
      );
      const updatedGroups = currentGroups
        .map((g: any) => ({
          ...g,
          nodeIds: g.nodeIds.filter((nid: string) => !toDeleteNodeIds.has(nid)),
        }))
        .filter((g: any) => g.nodeIds.length > 0);

      await saveGraphToFSAsync(newNodes, newEdges, updatedGroups);
      return NextResponse.json({
        success: true,
        deletedId: id,
        purgedNodeIds: orderedNodeIds,
        purgedPaths: Array.from(new Set(allPurgedPaths)),
      });
    }

    if (action === 'SAVE_GROUPS' || action === 'UPDATE_GROUPS') {
      const { groups } = payload;
      await saveGraphToFSAsync(currentNodes, currentEdges, groups || []);
      return NextResponse.json({ success: true, groups });
    }

    if (action === 'SAVE_LAYOUT') {
      const { nodes, edges, groups } = payload;
      await saveGraphToFSAsync(nodes || currentNodes, edges || currentEdges, groups || currentGroups);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

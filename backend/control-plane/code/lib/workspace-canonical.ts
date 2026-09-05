/**
 * ══════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL CANONICAL WORKSPACE NAMING LAW
 * ══════════════════════════════════════════════════════════════════════════════
 * Formula: ultrst_{app_name}_{user_name}_{workspace_name}
 *
 * Client-safe pure functions (zero Node.js fs/os dependencies) so they can be
 * imported safely in React client components and Node.js server routes.
 */

export function sanitizeFolderSegment(val: string): string {
  return (val || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'default';
}

export function formatCanonicalWorkspaceFolderName(
  appName: string = 'docustack',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  const rawWs = (workspaceName || '').trim();
  const app = sanitizeFolderSegment(appName);
  const user = sanitizeFolderSegment(userName);

  // If user already entered the full canonical format (e.g. ultrst_docustack_dinil_test_workspace),
  // or any ultrst_ prefix, preserve it without double-prefixing
  if (rawWs.toLowerCase().startsWith('ultrst_')) {
    return sanitizeFolderSegment(rawWs);
  }

  let ws = sanitizeFolderSegment(rawWs);
  // Simplify redundant app_vault or app_workspace patterns
  if (ws === `${app}_vault` || ws === `${app}_workspace`) {
    ws = ws.replace(`${app}_`, '');
  }

  return `ultrst_${app}_${user}_${ws}`;
}

export function formatCanonicalWorkspacePath(
  appName: string = 'docustack',
  userName: string = 'user',
  workspaceName: string = 'default'
): string {
  return `./${formatCanonicalWorkspaceFolderName(appName, userName, workspaceName)}`;
}

export function getSafeCloudFolderName(name: string): string {
  return (name || 'Folder')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Folder';
}

/**
 * Resolve the full nested storage path for a node by walking the parentId / edge chain
 * up through all ancestor folder nodes (stopping at workspace root).
 *
 * Example:
 *   Root -> Projects -> Frontend -> MyKanban
 *   resolveNodeNestedPath(MyKanban, allNodes, edges)
 *   => "Projects/Frontend/MyKanban"
 */
export function resolveNodeNestedPath(
  node: { id: string; title?: string; parentId?: string; isWorkspaceRoot?: boolean },
  allNodes: Array<{ id: string; title?: string; parentId?: string; isWorkspaceRoot?: boolean }>,
  edges: Array<{ source: string; target: string }> = []
): string {
  if (!node || node.isWorkspaceRoot || !node.title || !node.title.trim()) {
    return '';
  }

  const nodeMap = new Map<string, { id: string; title?: string; parentId?: string; isWorkspaceRoot?: boolean }>();
  for (const n of allNodes) {
    if (n && n.id) {
      nodeMap.set(n.id, n);
    }
  }

  // Build edge parent map: target -> source (source is parent of target)
  const edgeParentMap = new Map<string, string>();
  for (const edge of edges) {
    if (edge && edge.source && edge.target) {
      edgeParentMap.set(edge.target, edge.source);
    }
  }

  const pathSegments: string[] = [];
  let current: { id: string; title?: string; parentId?: string; isWorkspaceRoot?: boolean } | undefined = node;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break; // cycle guard
    visited.add(current.id);

    if (current.isWorkspaceRoot) break;
    if (!current.title || !current.title.trim()) break;

    pathSegments.unshift(getSafeCloudFolderName(current.title));

    // Walk up: prefer parentId field, then fall back to edge parent map
    const parentId = current.parentId || edgeParentMap.get(current.id);
    if (!parentId) break;

    const parent = nodeMap.get(parentId);
    if (!parent || parent.isWorkspaceRoot) break;
    current = parent;
  }

  return pathSegments.join('/');
}

/**
 * Deterministic Initial Workspace Files Generator
 * Single source of truth for all storage engines (Local FS, Backblaze B2, R2, S3, Supabase)
 * Clean initial state: Root node only, empty categories, empty documents, NO inbox/welcome_guide.
 */
export function getInitialWorkspaceFiles(
  workspaceName: string,
  folderPrefix: string,
  owner: string = 'User',
  provider: string = 'local_fs'
): Record<string, string> {
  const cleanPrefix = (folderPrefix || '').replace(/^\/+|\/+$/g, '').trim();
  const manifest = {
    workspaceName,
    folderPrefix: cleanPrefix,
    provider,
    initializedAt: new Date().toISOString(),
    owner,
    ecosystem: 'ultrst',
    app: 'docustack',
    directories: [],
  };

  const initialRootNode = {
    id: 'node-root',
    type: 'folder',
    title: workspaceName,
    isWorkspaceRoot: true,
    workspacePath: cleanPrefix,
    x: 360,
    y: 240,
    glyph: 'FolderArchive',
    tags: ['WORKSPACE', provider.toUpperCase()],
    color: '#D4AF37',
  };

  return {
    '.docustack/workspace_manifest.json': JSON.stringify(manifest, null, 2),
    '.docustack/graph.json': JSON.stringify({ nodes: [initialRootNode], edges: [], groups: [] }, null, 2),
    '.docustack/categories.json': JSON.stringify([], null, 2),
    '.docustack/documents_index.json': JSON.stringify([], null, 2),
  };
}

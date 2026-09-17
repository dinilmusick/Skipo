import { ListObjectsV2Command, ListObjectVersionsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection, GraphNode, GraphEdge, DocCategory, DocumentItem } from '../types';
import { buildS3Client } from '../storage-providers';
import { permanentDeleteS3Object } from './cloudStoragePermanentDelete';
import { resolveNodeNestedPath } from '../workspace-canonical';
import { getSafeCloudFolderName } from './cloudStorageNodeSync';

function buildValidKeysAndPrefixes(data: {
  nodes: GraphNode[]; edges: GraphEdge[]; categories: DocCategory[]; documents: DocumentItem[];
}) {
  const validKeys = new Set<string>([
    '.docustack/workspace_manifest.json', '.docustack/manifest.json',
    '.docustack/graph.json', '.docustack/categories.json',
    '.docustack/documents_index.json', '.docustack/theme.json',
  ]);
  const validDirPrefixes = new Set<string>(['.docustack/', 'inbox/', 'media/', 'notes/']);

  for (const node of data.nodes) {
    if (node.isWorkspaceRoot || !node.title?.trim()) continue;
    const safeTitle = getSafeCloudFolderName(node.title);
    const nestedPath = resolveNodeNestedPath(node, data.nodes, data.edges) || safeTitle;
    validDirPrefixes.add(`${nestedPath}/`);
    validDirPrefixes.add(`${safeTitle}/`);
    validKeys.add(`${nestedPath}/`);
    validKeys.add(`${safeTitle}/`);
    if (node.type === 'folder' || node.glyph === 'Folder') {
      validKeys.add(`${nestedPath}/.keep`);
      validKeys.add(`${nestedPath}/README.md`);
      validKeys.add(`${safeTitle}/.keep`);
      validKeys.add(`${safeTitle}/README.md`);
    } else if (node.type === 'collection' || node.glyph === 'Kanban') {
      validKeys.add(`${nestedPath}/kanban_board.json`);
      validKeys.add(`${safeTitle}/kanban_board.json`);
    } else if (node.type === 'sticky') {
      const safeSticky = (node.title || 'sticky').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      validKeys.add(`${safeSticky}.txt`);
    }
  }

  for (const cat of data.categories) {
    const colFolder = getSafeCloudFolderName(cat.title);
    if (!cat.boardId) {
      validKeys.add(`${colFolder}/.keep`);
      validKeys.add(`${colFolder}/README.md`);
      validDirPrefixes.add(`${colFolder}/`);
      validKeys.add(`${colFolder}/`);
    } else {
      const bNode = data.nodes.find((n) => (n.collectionId || n.id) === cat.boardId);
      const bPath = bNode ? resolveNodeNestedPath(bNode, data.nodes, data.edges) : 'Kanban';
      validDirPrefixes.add(`${bPath}/${colFolder}/`);
      validKeys.add(`${bPath}/${colFolder}/`);
    }
  }

  for (const doc of data.documents) {
    const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;
    const cat = data.categories.find((c) => c.id === doc.categoryId);
    if (cat) {
      const cf = getSafeCloudFolderName(cat.title);
      if (cat.boardId) {
        const bNode = data.nodes.find((n) => (n.collectionId || n.id) === cat.boardId);
        const bPath = bNode ? resolveNodeNestedPath(bNode, data.nodes, data.edges) : 'Kanban';
        validKeys.add(`${bPath}/${cf}/${filename}`);
      } else {
        validKeys.add(`${cf}/${filename}`);
      }
    } else if (doc.categoryId) {
      const fn = data.nodes.find((n) => n.id === doc.categoryId || n.title === doc.categoryId);
      const fp = fn ? resolveNodeNestedPath(fn, data.nodes, data.edges) : 'inbox';
      validKeys.add(`${fp}/${filename}`);
    } else {
      validKeys.add(`inbox/${filename}`);
    }
  }

  for (const key of validKeys) {
    const parts = key.split('/');
    let prefixAcc = '';
    for (let i = 0; i < parts.length - 1; i++) {
      prefixAcc += parts[i] + '/';
      validDirPrefixes.add(prefixAcc);
    }
  }
  return { validKeys, validDirPrefixes };
}

/**
 * Reconciles and purges orphaned objects and delete markers from cloud storage.
 */
export async function reconcileCloudWorkspaceOrphans(
  conn: UserStorageConnection,
  folderPrefix: string,
  data: { nodes: GraphNode[]; edges: GraphEdge[]; categories: DocCategory[]; documents: DocumentItem[]; }
): Promise<void> {
  try {
    const { validKeys, validDirPrefixes } = buildValidKeysAndPrefixes(data);

    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const prefixClean = folderPrefix.replace(/^\/+|\/+$/g, '') + '/';
      const listRes = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefixClean }));

      for (const obj of listRes.Contents || []) {
        if (!obj.Key) continue;
        const rel = obj.Key.substring(prefixClean.length);
        if (!rel || rel.startsWith('.docustack/wallpapers') || rel.startsWith('media/')) continue;
        const isDir = rel.endsWith('/');
        if ((isDir && !validDirPrefixes.has(rel) && !validKeys.has(rel)) || (!isDir && !validKeys.has(rel))) {
          try { await permanentDeleteS3Object(s3, bucketName, obj.Key); } catch (e) {}
        }
      }
      await purgeOrphanedDeleteMarkers(s3, bucketName, prefixClean);
    } else if (conn.provider === 'supabase_storage') {
      await purgeSupabaseOrphans(conn, folderPrefix, validKeys);
    }
  } catch (reconcileErr) {
    console.warn('[CloudStorage] Reconcile warning:', reconcileErr);
  }
}

async function purgeOrphanedDeleteMarkers(s3: any, bucketName: string, prefixClean: string): Promise<void> {
  try {
    let dmMarker: string | undefined;
    let dmVersionMarker: string | undefined;
    let moreDm = true;
    while (moreDm) {
      const cmd: any = { Bucket: bucketName, Prefix: prefixClean.replace(/\/+$/, '') };
      if (dmMarker) cmd.KeyMarker = dmMarker;
      if (dmVersionMarker && dmMarker) cmd.VersionIdMarker = dmVersionMarker;
      const verRes: any = await s3.send(new ListObjectVersionsCommand(cmd));
      const markers = (verRes.DeleteMarkers || [])
        .filter((dm: any) => dm.Key && dm.VersionId)
        .map((dm: any) => ({ Key: dm.Key, VersionId: dm.VersionId }));
      for (let i = 0; i < markers.length; i += 1000) {
        try {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: markers.slice(i, i + 1000), Quiet: true } }));
        } catch {}
      }
      moreDm = Boolean(verRes.IsTruncated);
      dmMarker = verRes.NextKeyMarker;
      dmVersionMarker = verRes.NextVersionIdMarker;
    }
  } catch (dmErr) {
    console.warn('[CloudStorage] Delete marker sweep bypassed:', dmErr);
  }
}

async function purgeSupabaseOrphans(conn: UserStorageConnection, folderPrefix: string, validKeys: Set<string>): Promise<void> {
  const url = (conn.supabaseUrl || '').trim();
  const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
  const bucket = (conn.supabaseBucketName || '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const prefixClean = folderPrefix.replace(/^\/+|\/+$/g, '');
  const { data: listData } = await supabase.storage.from(bucket).list(prefixClean);
  if (listData) {
    for (const item of listData) {
      if (!validKeys.has(item.name) && !item.name.startsWith('.docustack/wallpapers')) {
        await supabase.storage.from(bucket).remove([`${prefixClean}/${item.name}`]);
      }
    }
  }
}

/**
 * Cloud Storage Service — End-to-End Persistence for Backblaze B2, Cloudflare R2, AWS S3, & Supabase Storage
 *
 * Provides real read/write/list/delete/init operations directly against the user-owned
 * storage bucket under the workspace canonical prefix (e.g. ultrst_docustack_user_workspace/).
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection, GraphNode, DocumentItem, DocCategory, GraphEdge, GraphGroup } from './types';
import { buildS3Client } from './storage-providers';
import { resolveNodeNestedPath, getInitialWorkspaceFiles } from './workspace-canonical';

export interface CloudStorageFileInfo {
  key: string;
  name: string;
  size?: number;
  lastModified?: Date;
}

/**
 * Standardize path key under the bucket's workspace prefix.
 * Supports directory markers if relativePath is empty.
 */
function buildKey(folderPrefix: string, relativePath: string): string {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!relativePath || relativePath === '/' || relativePath === '') {
    return `${cleanPrefix}/`;
  }
  const cleanRel = relativePath.replace(/^\/+/g, '');
  return `${cleanPrefix}/${cleanRel}`;
}

/**
 * Ensure physical directory marker exists in S3 / Backblaze B2 bucket
 * Key ending with / ensures immediate visibility in Backblaze B2 console and S3 file managers.
 */
export async function ensureCloudDirectoryMarker(
  conn: UserStorageConnection,
  folderPrefix: string
): Promise<void> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!cleanPrefix) return;

  if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
    const { s3, bucketName } = buildS3Client(conn);
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `${cleanPrefix}/`,
          Body: Buffer.alloc(0),
          ContentType: 'application/x-directory',
        })
      );
    } catch (err: any) {
      console.warn(`[CloudStorage] Directory marker warning for ${cleanPrefix}/:`, err.message);
    }
  } else if (conn.provider === 'supabase_storage') {
    try {
      await writeCloudWorkspaceFile(conn, cleanPrefix, '.keep', '', 'text/plain');
    } catch {}
  }
}

/**
 * Write a file directly into user-owned Cloud Storage (Backblaze B2, R2, S3, Supabase)
 */
export async function writeCloudWorkspaceFile(
  conn: UserStorageConnection,
  folderPrefix: string,
  relativePath: string,
  content: string | Uint8Array,
  contentType: string = 'text/plain'
): Promise<void> {
  const fullKey = buildKey(folderPrefix, relativePath);

  if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
    const { s3, bucketName } = buildS3Client(conn);
    const bodyBuffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
        Body: bodyBuffer,
        ContentType: contentType,
      })
    );
    return;
  }

  if (conn.provider === 'supabase_storage') {
    const url = (conn.supabaseUrl || '').trim();
    const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
    const bucket = (conn.supabaseBucketName || '').trim();

    if (!url || !key || !bucket) {
      throw new Error('MISSING_SUPABASE_CREDENTIALS');
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const fileBody = typeof content === 'string' ? new Blob([content], { type: contentType }) : content;

    const { error } = await supabase.storage.from(bucket).upload(fullKey, fileBody, {
      upsert: true,
      contentType,
    });

    if (error) {
      throw new Error(`Supabase Storage Write Error: ${error.message}`);
    }
    return;
  }

  throw new Error(`UNSUPPORTED_CLOUD_STORAGE_PROVIDER: ${conn.provider}`);
}

/**
 * Read a file directly from user-owned Cloud Storage
 */
export async function readCloudWorkspaceFile(
  conn: UserStorageConnection,
  folderPrefix: string,
  relativePath: string
): Promise<string | null> {
  const fullKey = buildKey(folderPrefix, relativePath);

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: fullKey,
        })
      );

      if (!res.Body) return null;
      return await res.Body.transformToString('utf-8');
    }

    if (conn.provider === 'supabase_storage') {
      const url = (conn.supabaseUrl || '').trim();
      const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
      const bucket = (conn.supabaseBucketName || '').trim();

      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await supabase.storage.from(bucket).download(fullKey);

      if (error || !data) return null;
      return await data.text();
    }
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.message?.includes('not found')) {
      return null;
    }
    throw err;
  }

  return null;
}

/**
 * List files under a workspace folder in Cloud Storage
 */
export async function listCloudWorkspaceFiles(
  conn: UserStorageConnection,
  folderPrefix: string,
  subDir?: string
): Promise<CloudStorageFileInfo[]> {
  const targetPrefix = subDir ? buildKey(folderPrefix, subDir) : folderPrefix.replace(/^\/+|\/+$/g, '') + '/';

  if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
    const { s3, bucketName } = buildS3Client(conn);
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: targetPrefix,
      })
    );

    const contents = res.Contents || [];
    return contents.map((c) => ({
      key: c.Key || '',
      name: (c.Key || '').replace(targetPrefix, ''),
      size: c.Size,
      lastModified: c.LastModified,
    }));
  }

  if (conn.provider === 'supabase_storage') {
    const url = (conn.supabaseUrl || '').trim();
    const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
    const bucket = (conn.supabaseBucketName || '').trim();

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from(bucket).list(targetPrefix);

    if (error || !data) return [];
    return data.map((item) => ({
      key: `${targetPrefix}${item.name}`,
      name: item.name,
      size: item.metadata?.size,
      lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
    }));
  }

  return [];
}

/**
 * Permanently deletes an S3 / Backblaze B2 object, including all historical versions
 * and S3 Delete Markers, ensuring 0 asterisks or ghost files remain in Backblaze B2.
 */
export async function permanentDeleteS3Object(
  s3: any,
  bucketName: string,
  fullKey: string
): Promise<boolean> {
  try {
    const versionsToDelete: { Key: string; VersionId?: string }[] = [];
    try {
      const versionsRes: any = await s3.send(
        new ListObjectVersionsCommand({
          Bucket: bucketName,
          Prefix: fullKey,
        })
      );

      const versions = versionsRes.Versions || [];
      const deleteMarkers = versionsRes.DeleteMarkers || [];

      for (const v of versions) {
        if (v.Key === fullKey) {
          versionsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
        }
      }
      for (const dm of deleteMarkers) {
        if (dm.Key === fullKey) {
          versionsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
        }
      }
    } catch (verErr) {
      console.warn('[CloudStorage] ListObjectVersions not supported or failed on single file:', verErr);
    }

    if (versionsToDelete.length > 0) {
      for (let i = 0; i < versionsToDelete.length; i += 1000) {
        const batch = versionsToDelete.slice(i, i + 1000);
        try {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: {
                Objects: batch,
                Quiet: true,
              },
            })
          );
        } catch (batchErr) {
          for (const item of batch) {
            try {
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: item.Key,
                  VersionId: item.VersionId,
                })
              );
            } catch {}
          }
        }
      }
      return true;
    }

    // CRITICAL: If versionsToDelete is empty, NEVER call DeleteObjectCommand without VersionId!
    // In versioning-enabled buckets like Backblaze B2, sending DeleteObject without VersionId on a non-existent
    // key creates a Delete Marker (hide marker), which causes Backblaze B2 to display the asset with an asterisk (*).
    return true;
  } catch (err) {
    console.warn(`[CloudStorage] Error permanently deleting S3 object ${fullKey}:`, err);
    return false;
  }
}

/**
 * Permanently deletes an S3 / Backblaze B2 directory prefix, including all historical
 * versions and Delete Markers, ensuring 0 asterisks or ghost files remain in Backblaze B2.
 */
export async function permanentDeleteS3Folder(
  s3: any,
  bucketName: string,
  targetPrefix: string
): Promise<{ success: boolean; deletedCount: number }> {
  let deletedCount = 0;

  // Normalize targetPrefix: strip any trailing slashes so Prefix matches both the bare key and children
  const barePrefix = targetPrefix.replace(/\/+$/, '');
  const isMatch = (key: string) => key === barePrefix || key === `${barePrefix}/` || key.startsWith(`${barePrefix}/`);

  try {
    // 1. Paginate through all versions and delete markers under barePrefix
    let keyMarker: string | undefined = undefined;
    let versionIdMarker: string | undefined = undefined;
    let isTruncated = true;
    let versionsSupported = true;

    while (isTruncated && versionsSupported) {
      try {
        const cmdInput: any = {
          Bucket: bucketName,
          Prefix: barePrefix,
        };
        if (keyMarker) cmdInput.KeyMarker = keyMarker;
        if (versionIdMarker && keyMarker) cmdInput.VersionIdMarker = versionIdMarker;

        const verRes: any = await s3.send(new ListObjectVersionsCommand(cmdInput));

        const itemsToDelete: { Key: string; VersionId?: string }[] = [];
        if (verRes.Versions) {
          for (const v of verRes.Versions) {
            if (v.Key && isMatch(v.Key)) {
              itemsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
            }
          }
        }
        if (verRes.DeleteMarkers) {
          for (const dm of verRes.DeleteMarkers) {
            if (dm.Key && isMatch(dm.Key)) {
              itemsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
            }
          }
        }

        if (itemsToDelete.length > 0) {
          for (let i = 0; i < itemsToDelete.length; i += 1000) {
            const batch = itemsToDelete.slice(i, i + 1000);
            try {
              await s3.send(
                new DeleteObjectsCommand({
                  Bucket: bucketName,
                  Delete: {
                    Objects: batch,
                    Quiet: true,
                  },
                })
              );
              deletedCount += batch.length;
            } catch (batchErr) {
              for (const item of batch) {
                try {
                  await s3.send(
                    new DeleteObjectCommand({
                      Bucket: bucketName,
                      Key: item.Key,
                      VersionId: item.VersionId,
                    })
                  );
                  deletedCount++;
                } catch {}
              }
            }
          }
        }

        isTruncated = Boolean(verRes.IsTruncated);
        keyMarker = verRes.NextKeyMarker;
        versionIdMarker = verRes.NextVersionIdMarker;
      } catch (verErr) {
        console.warn('[CloudStorage] ListObjectVersions pagination unsupported or failed:', verErr);
        versionsSupported = false;
      }
    }

    // 2. Secondary sweep with ListObjectsV2Command (always resolving VersionId so NO delete markers are created)
    let contToken: string | undefined = undefined;
    let moreV2 = true;

    while (moreV2) {
      const listRes: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: barePrefix,
          ContinuationToken: contToken,
        })
      );

      const objects = listRes.Contents || [];
      for (const obj of objects) {
        if (!obj.Key) continue;
        if (isMatch(obj.Key)) {
          await permanentDeleteS3Object(s3, bucketName, obj.Key);
          deletedCount++;
        }
      }

      moreV2 = Boolean(listRes.IsTruncated);
      contToken = listRes.NextContinuationToken;
    }

    return { success: true, deletedCount };
  } catch (err) {
    console.error('[CloudStorage] permanentDeleteS3Folder failed:', err);
    return { success: false, deletedCount };
  }
}

/**
 * Delete a file in Cloud Storage
 */
export async function deleteCloudWorkspaceFile(
  conn: UserStorageConnection,
  folderPrefix: string,
  relativePath: string
): Promise<boolean> {
  const fullKey = buildKey(folderPrefix, relativePath);

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      return await permanentDeleteS3Object(s3, bucketName, fullKey);
    }

    if (conn.provider === 'supabase_storage') {
      const url = (conn.supabaseUrl || '').trim();
      const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
      const bucket = (conn.supabaseBucketName || '').trim();

      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await supabase.storage.from(bucket).remove([fullKey]);
      return !error;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Recursively delete an entire folder and all contained objects in Cloud Storage.
 * When folderRelativePath is empty or root, purges the entire workspace folder prefix.
 */
export async function deleteCloudWorkspaceFolder(
  conn: UserStorageConnection,
  folderPrefix: string,
  folderRelativePath: string = ''
): Promise<{ success: boolean; deletedCount: number }> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const cleanRel = (folderRelativePath || '').replace(/^\/+|\/+$/g, '');
  if (!cleanPrefix && !cleanRel) return { success: false, deletedCount: 0 };

  const bareKey = cleanRel ? `${cleanPrefix}/${cleanRel}` : cleanPrefix;
  const targetPrefix = cleanRel ? `${cleanPrefix}/${cleanRel}/` : `${cleanPrefix}/`;

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      // permanentDeleteS3Folder targets bareKey and bareKey/ and purges all versions and delete markers
      return await permanentDeleteS3Folder(s3, bucketName, bareKey);
    }

    if (conn.provider === 'supabase_storage') {
      const url = (conn.supabaseUrl || '').trim();
      const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
      const bucket = (conn.supabaseBucketName || '').trim();

      const supabase = createClient(url, key, { auth: { persistSession: false } });
      let deletedCount = 0;
      const { data } = await supabase.storage.from(bucket).list(targetPrefix);
      if (data && data.length > 0) {
        const keys = data.map((item) => `${targetPrefix}${item.name}`);
        const { error } = await supabase.storage.from(bucket).remove(keys);
        if (!error) deletedCount = keys.length;
      }
      return { success: true, deletedCount };
    }
  } catch (err) {
    console.warn(`[CloudStorage] Error deleting cloud folder ${targetPrefix}:`, err);
    return { success: false, deletedCount: 0 };
  }

  return { success: false, deletedCount: 0 };
}

/**
 * Delete all cloud storage files and directories associated with a graph node
 * (e.g. folder nodes, Kanban board folders and column subfolders, sticky note txt files)
 */
export async function deleteCloudNodeAssets(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  categories: DocCategory[] = [],
  nestedPath?: string
): Promise<{ success: boolean; purgedPaths: string[] }> {
  const purgedPaths: string[] = [];
  if (!conn || !folderPrefix || node.isWorkspaceRoot) {
    return { success: false, purgedPaths };
  }

  const safeTitle = getSafeCloudFolderName(node.title);
  const targetFolder = nestedPath || safeTitle;

  if (node.type === 'collection' || node.glyph === 'Kanban') {
    const boardId = node.collectionId || node.id;
    const cols = categories.filter((c) => c.boardId === boardId);

    // 1. Delete all column subfolders first (contents inside)
    for (const col of cols) {
      const colTitle = getSafeCloudFolderName(col.title);
      await deleteCloudWorkspaceFolder(conn, folderPrefix, `${targetFolder}/${colTitle}`);
      purgedPaths.push(`${targetFolder}/${colTitle}`);
      if (targetFolder !== safeTitle) {
        await deleteCloudWorkspaceFolder(conn, folderPrefix, `${safeTitle}/${colTitle}`);
      }
      await deleteCloudWorkspaceFolder(conn, folderPrefix, colTitle);
      purgedPaths.push(colTitle);
    }

    // 2. Delete the board manifest file
    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/kanban_board.json`);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/kanban_board.json`);
    }

    // 3. Finally delete the upper layer Kanban folder
    await deleteCloudWorkspaceFolder(conn, folderPrefix, targetFolder);
    purgedPaths.push(targetFolder);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFolder(conn, folderPrefix, safeTitle);
      purgedPaths.push(safeTitle);
    }
  } else if (node.type === 'folder' || node.glyph === 'Folder') {
    // 1. Delete files inside first (.keep, README.md)
    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/.keep`);
    await deleteCloudWorkspaceFile(conn, folderPrefix, `${targetFolder}/README.md`);
    if (targetFolder !== safeTitle) {
      await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/.keep`);
      await deleteCloudWorkspaceFile(conn, folderPrefix, `${safeTitle}/README.md`);
    }

    // 2. Finally delete the upper layer folder
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

/**
 * Initialize a full workspace folder layout on Cloud Storage
 * Creates the canonical directory structure, manifests, graph topology, categories, and welcome document.
 */
/**
 * Purge any default legacy assets (e.g. Core_Kanban, default categories, welcome doc)
 * from a cloud storage workspace.
 */
export async function purgeDefaultCloudWorkspaceAssets(
  conn: UserStorageConnection,
  folderPrefix: string
): Promise<void> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!cleanPrefix) return;

  try {
    // 1. Delete default Core_Kanban directories from cloud bucket
    await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'Core_Kanban');
    await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'core_kanban');

    // 2. Clean graph.json if it contains the default node-core-kanban
    try {
      const graphContent = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json');
      if (graphContent) {
        const graph = JSON.parse(graphContent);
        let modified = false;
        if (Array.isArray(graph.nodes)) {
          const filteredNodes = graph.nodes.filter(
            (n: any) => n.id !== 'node-core-kanban' && n.collectionId !== 'kanban-main' && n.title !== 'Core_Kanban'
          );
          if (filteredNodes.length !== graph.nodes.length) {
            graph.nodes = filteredNodes;
            modified = true;
          }
        }
        if (Array.isArray(graph.edges)) {
          const filteredEdges = graph.edges.filter(
            (e: any) => e.source !== 'node-core-kanban' && e.target !== 'node-core-kanban'
          );
          if (filteredEdges.length !== graph.edges.length) {
            graph.edges = filteredEdges;
            modified = true;
          }
        }
        if (modified) {
          await writeCloudWorkspaceFile(
            conn,
            cleanPrefix,
            '.docustack/graph.json',
            JSON.stringify(graph, null, 2),
            'application/json'
          );
        }
      }
    } catch {}

    // 3. Clean categories.json if it contains default categories
    try {
      const catContent = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/categories.json');
      if (catContent) {
        const cats = JSON.parse(catContent);
        if (Array.isArray(cats)) {
          const filteredCats = cats.filter(
            (c: any) => c.boardId !== 'kanban-main' && c.id !== 'cat-todo' && c.id !== 'cat-progress' && c.id !== 'cat-done'
          );
          if (filteredCats.length !== cats.length) {
            await writeCloudWorkspaceFile(
              conn,
              cleanPrefix,
              '.docustack/categories.json',
              JSON.stringify(filteredCats, null, 2),
              'application/json'
            );
          }
        }
      }
    } catch {}

    // 4. Clean documents_index.json if it contains default welcome doc
    try {
      const docContent = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/documents_index.json');
      if (docContent) {
        const docs = JSON.parse(docContent);
        if (Array.isArray(docs)) {
          const filteredDocs = docs.filter(
            (d: any) => d.id !== 'doc-welcome' && !d.title?.startsWith('WELCOME_TO_')
          );
          if (filteredDocs.length !== docs.length) {
            await writeCloudWorkspaceFile(
              conn,
              cleanPrefix,
              '.docustack/documents_index.json',
              JSON.stringify(filteredDocs, null, 2),
              'application/json'
            );
          }
        }
      }
    } catch {}
  } catch (err) {
    console.warn('[CloudStorage] purgeDefaultCloudWorkspaceAssets warning:', err);
  }
}

/**
 * Initialize a clean workspace folder layout on Cloud Storage.
 * Creates only the canonical manifests and root workspace node — NO default boards,
 * categories, or placeholder files are created, and any legacy defaults are expunged.
 */
export async function initializeCloudWorkspaceBucket(
  conn: UserStorageConnection,
  folderPrefix: string,
  workspaceName: string,
  userName: string = 'User'
): Promise<{ success: boolean; filesCreated: string[] }> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const filesCreated: string[] = [];

  // 1. Physically ensure workspace folder marker exists in Backblaze B2 / S3
  await ensureCloudDirectoryMarker(conn, cleanPrefix);

  // CRITICAL IDEMPOTENCY GUARD:
  // Check if .docustack/graph.json already exists in the cloud bucket.
  // If it already exists, purge any leftover legacy default assets and preserve user data.
  try {
    const existingGraph = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json');
    if (existingGraph && existingGraph.trim().length > 0) {
      await purgeDefaultCloudWorkspaceAssets(conn, cleanPrefix);
      return { success: true, filesCreated: [] };
    }
  } catch {
    // If not found or read error, proceed with clean initialization
  }

  // 2. Write unified initial workspace files (single source of truth)
  const initialFiles = getInitialWorkspaceFiles(workspaceName, cleanPrefix, userName, conn.provider);
  for (const [relPath, content] of Object.entries(initialFiles)) {
    await writeCloudWorkspaceFile(conn, cleanPrefix, relPath, content, 'application/json');
    filesCreated.push(relPath);
  }

  // 3. Purge any legacy default folders if they were created earlier
  await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'Core_Kanban');
  await deleteCloudWorkspaceFolder(conn, cleanPrefix, 'core_kanban');

  return { success: true, filesCreated };
}

/**
 * Sanitize folder title into a valid S3 key / filesystem directory name
 */
export function getSafeCloudFolderName(rawTitle: string): string {
  const sanitized = (rawTitle || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_');
  return sanitized || 'folder';
}

/**
 * Persist a Folder node physically to user Cloud Storage (Backblaze B2, R2, S3, Supabase)
 * Creates real S3 prefix with .keep and README.md so the folder appears in bucket browser
 */
export async function syncFolderNodeToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  nestedPath?: string  // pre-computed full nested path (e.g. "Projects/Frontend/MyFolder")
): Promise<void> {
  // Use the pre-computed nested path if provided; otherwise fall back to the node's own name
  const folderName = nestedPath || getSafeCloudFolderName(node.title || 'Folder');
  const readme = `# ${node.title || 'Folder'}\n\nFolder created in DocuStack Workspace.\n- Tags: ${(node.tags || []).join(', ') || 'none'}\n- Created: ${new Date().toISOString()}\n`;

  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/.keep`, '', 'text/plain');
  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/README.md`, readme, 'text/markdown');
}

/**
 * Persist a Kanban board node physically to user Cloud Storage
 * Creates dedicated Board folder with kanban_board.json (NO placeholder column subfolders)
 */
export async function syncKanbanNodeToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  columns: DocCategory[] = [],
  nestedPath?: string  // pre-computed full nested path (e.g. "Projects/Frontend/MyKanban")
): Promise<void> {
  // Use the pre-computed nested path if provided; otherwise fall back to the node's own name
  const boardFolder = nestedPath || getSafeCloudFolderName(node.title || 'Kanban_Board');

  // 1. Ensure dedicated board directory exists in cloud bucket
  await ensureCloudDirectoryMarker(conn, `${folderPrefix}/${boardFolder}`);

  // 2. Board Manifest
  const boardManifest = {
    id: node.collectionId || node.id,
    title: node.title || 'Kanban Board',
    glyph: node.glyph || 'Kanban',
    color: node.color || '#D4AF37',
    tags: node.tags || ['Kanban'],
    columns: columns.map((c) => ({
      id: c.id,
      title: c.title,
      glyph: c.glyph,
      color: c.color,
      description: c.description,
    })),
    updatedAt: new Date().toISOString(),
  };

  await writeCloudWorkspaceFile(
    conn,
    folderPrefix,
    `${boardFolder}/kanban_board.json`,
    JSON.stringify(boardManifest, null, 2),
    'application/json'
  );

  // Note: Column subfolders are NOT created as placeholders; documents are placed directly or in columns when assigned.
}

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

      // Check if document belongs to a Kanban column or folder
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
  try {
    const validRelativeKeys = new Set<string>([
      '.docustack/workspace_manifest.json',
      '.docustack/manifest.json',
      '.docustack/graph.json',
      '.docustack/categories.json',
      '.docustack/documents_index.json',
      '.docustack/theme.json',
    ]);

    // Active folder and kanban nodes (register both nested paths and fallbacks)
    for (const node of data.nodes) {
      if (node.isWorkspaceRoot || !node.title || !node.title.trim()) continue;
      const safeTitle = getSafeCloudFolderName(node.title);
      const nestedPath = resolveNodeNestedPath(node, data.nodes, data.edges) || safeTitle;

      if (node.type === 'folder' || node.glyph === 'Folder') {
        validRelativeKeys.add(`${nestedPath}/.keep`);
        validRelativeKeys.add(`${nestedPath}/README.md`);
        validRelativeKeys.add(`${safeTitle}/.keep`);
        validRelativeKeys.add(`${safeTitle}/README.md`);
      } else if (node.type === 'collection' || node.glyph === 'Kanban') {
        validRelativeKeys.add(`${nestedPath}/kanban_board.json`);
        validRelativeKeys.add(`${safeTitle}/kanban_board.json`);
      } else if (node.type === 'sticky') {
        const safeSticky = (node.title || 'sticky').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
        validRelativeKeys.add(`${safeSticky}.txt`);
      }
    }

    // Active root categories
    for (const cat of data.categories) {
      if (!cat.boardId) {
        const colFolder = getSafeCloudFolderName(cat.title);
        validRelativeKeys.add(`${colFolder}/.keep`);
        validRelativeKeys.add(`${colFolder}/README.md`);
      }
    }

    // Active documents
    for (const doc of data.documents) {
      const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;
      const assignedCat = data.categories.find((c) => c.id === doc.categoryId);
      if (assignedCat) {
        const catFolder = getSafeCloudFolderName(assignedCat.title);
        if (assignedCat.boardId) {
          const boardNode = data.nodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
          const boardPath = boardNode ? resolveNodeNestedPath(boardNode, data.nodes, data.edges) : 'Kanban';
          validRelativeKeys.add(`${boardPath}/${catFolder}/${filename}`);
        } else {
          validRelativeKeys.add(`${catFolder}/${filename}`);
        }
      } else if (doc.categoryId) {
        const folderNode = data.nodes.find((n) => n.id === doc.categoryId || n.title === doc.categoryId);
        if (folderNode) {
          const folderPath = resolveNodeNestedPath(folderNode, data.nodes, data.edges);
          validRelativeKeys.add(`${folderPath}/${filename}`);
        }
      } else {
        validRelativeKeys.add(`inbox/${filename}`);
      }
    }

    // Prune orphaned objects from bucket
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const prefixClean = folderPrefix.replace(/^\/+|\/+$/g, '') + '/';

      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefixClean,
        })
      );

      const objects = listRes.Contents || [];
      for (const obj of objects) {
        if (!obj.Key) continue;
        const rel = obj.Key.substring(prefixClean.length);
        if (!rel || rel.endsWith('/')) continue;
        // Do not delete uploaded wallpapers or media
        if (rel.startsWith('.docustack/wallpapers') || rel.startsWith('media/')) continue;

        if (!validRelativeKeys.has(rel)) {
          try {
            await permanentDeleteS3Object(s3, bucketName, obj.Key);
          } catch (delErr) {
            console.warn(`[CloudStorage] Error deleting orphaned key ${obj.Key}:`, delErr);
          }
        }
      }

      // 6b. Sweep and purge any orphaned Delete Markers (asterisks) in Backblaze B2 across the workspace prefix
      try {
        let dmMarker: string | undefined = undefined;
        let dmVersionMarker: string | undefined = undefined;
        let moreDm = true;

        while (moreDm) {
          const cmdInput: any = {
            Bucket: bucketName,
            Prefix: prefixClean.replace(/\/+$/, ''),
          };
          if (dmMarker) cmdInput.KeyMarker = dmMarker;
          if (dmVersionMarker && dmMarker) cmdInput.VersionIdMarker = dmVersionMarker;

          const verRes: any = await s3.send(new ListObjectVersionsCommand(cmdInput));
          const deleteMarkers = verRes.DeleteMarkers || [];
          const orphanedMarkersToDelete: { Key: string; VersionId: string }[] = [];

          for (const dm of deleteMarkers) {
            if (!dm.Key || !dm.VersionId) continue;
            // Purge any delete marker under the workspace prefix
            orphanedMarkersToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
          }

          if (orphanedMarkersToDelete.length > 0) {
            for (let i = 0; i < orphanedMarkersToDelete.length; i += 1000) {
              const batch = orphanedMarkersToDelete.slice(i, i + 1000);
              try {
                await s3.send(
                  new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: batch, Quiet: true },
                  })
                );
              } catch {}
            }
          }

          moreDm = Boolean(verRes.IsTruncated);
          dmMarker = verRes.NextKeyMarker;
          dmVersionMarker = verRes.NextVersionIdMarker;
        }
      } catch (dmErr) {
        console.warn('[CloudStorage] Delete marker sweep bypassed:', dmErr);
      }
    } else if (conn.provider === 'supabase_storage') {
      const url = (conn.supabaseUrl || '').trim();
      const key = (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim();
      const bucket = (conn.supabaseBucketName || '').trim();
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const prefixClean = folderPrefix.replace(/^\/+|\/+$/g, '');

      const { data: listData } = await supabase.storage.from(bucket).list(prefixClean);
      if (listData) {
        for (const item of listData) {
          if (!validRelativeKeys.has(item.name) && !item.name.startsWith('.docustack/wallpapers')) {
            await supabase.storage.from(bucket).remove([`${prefixClean}/${item.name}`]);
          }
        }
      }
    }
  } catch (reconcileErr) {
    console.warn('[CloudStorage] Reconcile warning:', reconcileErr);
  }

  return { success: true, syncedCount };
}

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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Build a hierarchical FileTreeNode representation of user-owned Cloud Storage
 * directly from Backblaze B2, Cloudflare R2, AWS S3, or Supabase.
 */
export async function buildCloudWorkspaceFileTree(
  conn: UserStorageConnection,
  folderPrefix: string
): Promise<{ tree: FileTreeNode; stats: { fileCount: number; folderCount: number } }> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  let files = await listCloudWorkspaceFiles(conn, cleanPrefix);

  if (files.length === 0) {
    try {
      await initializeCloudWorkspaceBucket(conn, cleanPrefix, cleanPrefix, 'User');
      files = await listCloudWorkspaceFiles(conn, cleanPrefix);
    } catch (e) {
      console.warn('[CloudStorage] Auto init during build tree fallback:', e);
    }
  }

  const bucketLabel =
    conn.provider === 'backblaze_b2'
      ? `Backblaze B2: ${conn.b2BucketName || 'bucket'}`
      : conn.provider === 'cloudflare_r2'
      ? `Cloudflare R2: ${conn.r2BucketName || 'bucket'}`
      : conn.provider === 'aws_s3'
      ? `AWS S3: ${conn.s3BucketName || 'bucket'}`
      : `Supabase: ${conn.supabaseBucketName || 'bucket'}`;

  const root: FileTreeNode = {
    name: cleanPrefix,
    relativePath: '',
    absolutePath: `[${bucketLabel}] / ${cleanPrefix}`,
    isDirectory: true,
    children: [],
  };

  let fileCount = 0;
  let folderCount = 0;

  for (const item of files) {
    const cleanRel = item.name.replace(/^\/+/, '');
    if (!cleanRel) continue;

    // Filter out internal control plane metadata directory from user-facing tree
    if (cleanRel.startsWith('.docustack/') || cleanRel === '.docustack') continue;

    const parts = cleanRel.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const subRel = parts.slice(0, i + 1).join('/');

      if (isLast) {
        // Filter out S3 keep tokens so empty folders show up without cluttering file count
        if (part === '.keep') continue;

        // File node
        if (!current.children) current.children = [];
        let existingFile = current.children.find((c) => !c.isDirectory && c.name === part);
        if (!existingFile) {
          fileCount++;
          current.children.push({
            name: part,
            relativePath: subRel,
            absolutePath: `[${bucketLabel}] / ${cleanPrefix}/${subRel}`,
            isDirectory: false,
            sizeBytes: item.size,
            sizeFormatted: formatBytes(item.size),
            modifiedAt: item.lastModified ? item.lastModified.toLocaleDateString() : undefined,
          });
        }
      } else {
        // Directory node
        if (!current.children) current.children = [];
        let folder = current.children.find((c) => c.isDirectory && c.name === part);
        if (!folder) {
          folderCount++;
          folder = {
            name: part,
            relativePath: subRel,
            absolutePath: `[${bucketLabel}] / ${cleanPrefix}/${subRel}`,
            isDirectory: true,
            children: [],
          };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  function sortNode(node: FileTreeNode) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
    node.children.forEach(sortNode);
  }
  sortNode(root);

  return {
    tree: root,
    stats: { fileCount, folderCount },
  };
}

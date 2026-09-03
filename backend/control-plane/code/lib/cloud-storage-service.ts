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

export interface CloudStorageFileInfo {
  key: string;
  name: string;
  size?: number;
  lastModified?: Date;
}

/**
 * Standardize path key under the bucket's workspace prefix
 */
function buildKey(folderPrefix: string, relativePath: string): string {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const cleanRel = relativePath.replace(/^\/+/g, '');
  return `${cleanPrefix}/${cleanRel}`;
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
    let versionsToDelete: { Key: string; VersionId?: string }[] = [];
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
      console.warn('[CloudStorage] ListObjectVersions not supported or failed on single file, fallback to standard delete:', verErr);
    }

    if (versionsToDelete.length > 0) {
      try {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: versionsToDelete,
              Quiet: true,
            },
          })
        );
        return true;
      } catch (batchErr) {
        for (const item of versionsToDelete) {
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
        return true;
      }
    }

    // Fallback standard delete
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
      })
    );
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

  try {
    // 1. Paginate through all versions and delete markers under targetPrefix
    let keyMarker: string | undefined = undefined;
    let versionIdMarker: string | undefined = undefined;
    let isTruncated = true;
    let versionsSupported = true;

    while (isTruncated && versionsSupported) {
      try {
        const cmdInput: any = {
          Bucket: bucketName,
          Prefix: targetPrefix,
        };
        if (keyMarker) cmdInput.KeyMarker = keyMarker;
        if (versionIdMarker && keyMarker) cmdInput.VersionIdMarker = versionIdMarker;

        const verRes: any = await s3.send(new ListObjectVersionsCommand(cmdInput));

        const itemsToDelete: { Key: string; VersionId?: string }[] = [];
        if (verRes.Versions) {
          for (const v of verRes.Versions) {
            if (v.Key) itemsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
          }
        }
        if (verRes.DeleteMarkers) {
          for (const dm of verRes.DeleteMarkers) {
            if (dm.Key) itemsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
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

    // 2. Also run ListObjectsV2Command to clean any unversioned files or if versions were unsupported
    let contToken: string | undefined = undefined;
    let moreV2 = true;

    while (moreV2) {
      const listRes: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: targetPrefix,
          ContinuationToken: contToken,
        })
      );

      const objects = listRes.Contents || [];
      if (objects.length > 0) {
        for (const obj of objects) {
          if (obj.Key) {
            try {
              await permanentDeleteS3Object(s3, bucketName, obj.Key);
              deletedCount++;
            } catch {
              try {
                await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key }));
                deletedCount++;
              } catch {}
            }
          }
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

  const targetPrefix = cleanRel ? `${cleanPrefix}/${cleanRel}/` : `${cleanPrefix}/`;

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const res = await permanentDeleteS3Folder(s3, bucketName, targetPrefix);
      const bareKey = cleanRel ? `${cleanPrefix}/${cleanRel}` : cleanPrefix;
      if (bareKey) {
        await permanentDeleteS3Object(s3, bucketName, bareKey);
      }
      return res;
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
  categories: DocCategory[] = []
): Promise<{ success: boolean; purgedPaths: string[] }> {
  const purgedPaths: string[] = [];
  if (!conn || !folderPrefix || node.isWorkspaceRoot) {
    return { success: false, purgedPaths };
  }

  const safeTitle = getSafeCloudFolderName(node.title);

  if (node.type === 'folder' || node.glyph === 'Folder') {
    await deleteCloudWorkspaceFolder(conn, folderPrefix, safeTitle);
    purgedPaths.push(safeTitle);
  } else if (node.type === 'collection' || node.glyph === 'Kanban') {
    const boardId = node.collectionId || node.id;
    await deleteCloudWorkspaceFolder(conn, folderPrefix, safeTitle);
    purgedPaths.push(safeTitle);

    // Also purge any categories for this board that were stored at root
    const cols = categories.filter((c) => c.boardId === boardId);
    for (const col of cols) {
      const colTitle = getSafeCloudFolderName(col.title);
      await deleteCloudWorkspaceFolder(conn, folderPrefix, colTitle);
      purgedPaths.push(colTitle);
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
export async function initializeCloudWorkspaceBucket(
  conn: UserStorageConnection,
  folderPrefix: string,
  workspaceName: string,
  userName: string = 'User'
): Promise<{ success: boolean; filesCreated: string[] }> {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const filesCreated: string[] = [];

  // CRITICAL IDEMPOTENCY GUARD:
  // Check if .docustack/graph.json already exists in the cloud bucket.
  // If it already exists, the workspace has already been created/configured with user nodes and cards.
  // Never overwrite existing user data!
  try {
    const existingGraph = await readCloudWorkspaceFile(conn, cleanPrefix, '.docustack/graph.json');
    if (existingGraph && existingGraph.trim().length > 0) {
      return { success: true, filesCreated: [] };
    }
  } catch {
    // If not found or read error, proceed with safe initialization
  }

  const boardTitle = 'Core_Kanban';
  const initialCategories: DocCategory[] = [
    {
      id: 'cat-todo',
      boardId: 'kanban-main',
      title: 'To Do',
      description: 'Tasks and documents to start',
      glyph: 'Inbox',
      color: '#3B82F6',
    },
    {
      id: 'cat-progress',
      boardId: 'kanban-main',
      title: 'In Progress',
      description: 'Active tasks and documents in progress',
      glyph: 'Flame',
      color: '#F97316',
    },
    {
      id: 'cat-done',
      boardId: 'kanban-main',
      title: 'Done',
      description: 'Completed items and documentation',
      glyph: 'Shield',
      color: '#10B981',
    },
  ];

  const manifest = {
    workspaceName,
    folderPrefix: cleanPrefix,
    provider: conn.provider,
    label: conn.label,
    initializedAt: new Date().toISOString(),
    owner: userName,
    ecosystem: 'ultrst',
    app: 'docustack',
    directories: [
      `${boardTitle}/To_Do`,
      `${boardTitle}/In_Progress`,
      `${boardTitle}/Done`,
    ],
  };

  const initialRootNode: GraphNode = {
    id: 'node-root',
    type: 'folder',
    title: workspaceName,
    isWorkspaceRoot: true,
    workspacePath: cleanPrefix,
    x: 360,
    y: 240,
    glyph: 'FolderArchive',
    tags: ['WORKSPACE', 'CLOUD_VAULT', conn.provider.toUpperCase()],
    color: '#D4AF37',
  };

  const initialBoardNode: GraphNode = {
    id: 'node-core-kanban',
    collectionId: 'kanban-main',
    type: 'collection',
    title: boardTitle,
    x: 640,
    y: 240,
    glyph: 'Kanban',
    tags: ['Kanban', 'Workflow'],
    color: '#D4AF37',
  };

  const safeWsTitle = workspaceName.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const welcomeDocContent = `# ${workspaceName}

Welcome to **${workspaceName}**, powered by DocuStack and connected to your user-owned **${conn.label || conn.provider}** bucket.

- **Storage Provider**: ${conn.provider}
- **Canonical Folder**: \`${cleanPrefix}\`
- **Initialized**: ${new Date().toLocaleString()}
- **Ecosystem**: Ultrst Open Ecosystem

All markdown notes, Kanban boards, folders, and documents uploaded here are saved directly into your cloud storage bucket.
`;

  const initialDocuments: DocumentItem[] = [
    {
      id: 'doc-welcome',
      categoryId: 'cat-todo',
      title: `WELCOME_TO_${safeWsTitle}.MD`,
      description: `Cloud workspace guide for ${workspaceName}`,
      content: welcomeDocContent,
      fileType: 'code',
      fileSize: '2 KB',
      uploadedAt: new Date().toISOString().split('T')[0],
      tags: ['WORKSPACE', 'CLOUD_VAULT', conn.provider.toUpperCase()],
      aiSummary: `Initial welcome guide saved directly inside ${cleanPrefix} in your ${conn.provider} bucket.`,
    },
  ];

  // 1. Write workspace_manifest.json
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    '.docustack/workspace_manifest.json',
    JSON.stringify(manifest, null, 2),
    'application/json'
  );
  filesCreated.push('.docustack/workspace_manifest.json');

  // 2. Write graph.json with root and initial Kanban board node
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    '.docustack/graph.json',
    JSON.stringify({ nodes: [initialRootNode, initialBoardNode], edges: [], groups: [] }, null, 2),
    'application/json'
  );
  filesCreated.push('.docustack/graph.json');

  // 3. Write categories.json
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    '.docustack/categories.json',
    JSON.stringify(initialCategories, null, 2),
    'application/json'
  );
  filesCreated.push('.docustack/categories.json');

  // 4. Write documents_index.json
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    '.docustack/documents_index.json',
    JSON.stringify(initialDocuments, null, 2),
    'application/json'
  );
  filesCreated.push('.docustack/documents_index.json');

  // 5. Create physical column directories with .keep
  for (const col of initialCategories) {
    const colFolder = getSafeCloudFolderName(col.title);
    await writeCloudWorkspaceFile(
      conn,
      cleanPrefix,
      `${boardTitle}/${colFolder}/.keep`,
      '',
      'text/plain'
    );
    filesCreated.push(`${boardTitle}/${colFolder}/.keep`);
  }

  // 6. Write actual welcome document into the To Do column of the Kanban board
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    `${boardTitle}/To_Do/WELCOME_TO_${safeWsTitle}.MD`,
    welcomeDocContent,
    'text/markdown'
  );
  filesCreated.push(`${boardTitle}/To_Do/WELCOME_TO_${safeWsTitle}.MD`);

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
  node: GraphNode
): Promise<void> {
  const folderName = getSafeCloudFolderName(node.title || 'Folder');
  const readme = `# ${node.title || 'Folder'}\n\nFolder created in DocuStack Workspace.\n- Tags: ${(node.tags || []).join(', ') || 'none'}\n- Created: ${new Date().toISOString()}\n`;

  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/.keep`, '', 'text/plain');
  await writeCloudWorkspaceFile(conn, folderPrefix, `${folderName}/README.md`, readme, 'text/markdown');
}

/**
 * Persist a Kanban board node physically to user Cloud Storage
 * Creates dedicated Board folder with kanban_board.json and column subfolders
 */
export async function syncKanbanNodeToCloud(
  conn: UserStorageConnection,
  folderPrefix: string,
  node: GraphNode,
  columns: DocCategory[] = []
): Promise<void> {
  const boardFolder = getSafeCloudFolderName(node.title || 'Kanban_Board');

  // 1. Board Manifest
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

  // 2. Ensure each column has physical folder in cloud bucket
  const colsToSync = columns.length > 0 ? columns : [
    { id: 'todo', title: 'To Do' },
    { id: 'progress', title: 'In Progress' },
    { id: 'done', title: 'Done' },
  ];

  for (const col of colsToSync) {
    const colName = getSafeCloudFolderName(col.title);
    const readme = `# ${col.title}\nColumn for Kanban board **${node.title}**.\n`;
    await writeCloudWorkspaceFile(conn, folderPrefix, `${boardFolder}/${colName}/.keep`, '', 'text/plain');
    await writeCloudWorkspaceFile(conn, folderPrefix, `${boardFolder}/${colName}/README.md`, readme, 'text/markdown');
  }
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

  // 4. Physical Folder & Kanban Nodes Sync
  for (const node of data.nodes) {
    if (node.isWorkspaceRoot) continue;
    if (node.type === 'folder' || node.glyph === 'Folder') {
      try {
        await syncFolderNodeToCloud(conn, folderPrefix, node);
        syncedCount++;
      } catch (err) {
        console.warn(`[CloudStorage] Error syncing folder node ${node.title}:`, err);
      }
    } else if (node.type === 'collection' || node.glyph === 'Kanban') {
      try {
        const boardId = node.collectionId || node.id;
        const boardCols = data.categories.filter((c) => c.boardId === boardId);
        await syncKanbanNodeToCloud(conn, folderPrefix, node, boardCols);
        syncedCount++;
      } catch (err) {
        console.warn(`[CloudStorage] Error syncing kanban node ${node.title}:`, err);
      }
    }
  }

  // 5. Individual Document Physical Markdown Files
  for (const doc of data.documents) {
    try {
      const safeTitle = (doc.title || 'untitled').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`;

      // Check if document belongs to a Kanban column
      const assignedCat = data.categories.find((c) => c.id === doc.categoryId);
      let targetPath = `inbox/${filename}`;

      if (assignedCat) {
        const catFolder = getSafeCloudFolderName(assignedCat.title);
        if (assignedCat.boardId) {
          const boardNode = data.nodes.find((n) => (n.collectionId || n.id) === assignedCat.boardId);
          const boardFolder = getSafeCloudFolderName(boardNode?.title || 'Kanban');
          targetPath = `${boardFolder}/${catFolder}/${filename}`;
        } else {
          targetPath = `${catFolder}/${filename}`;
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
      '.docustack/manifest.json',
      '.docustack/graph.json',
      '.docustack/categories.json',
      '.docustack/documents_index.json',
      '.docustack/theme.json',
      'inbox/.keep',
    ]);

    // Active folder and kanban nodes
    for (const node of data.nodes) {
      if (node.isWorkspaceRoot) continue;
      const safeTitle = getSafeCloudFolderName(node.title);
      if (node.type === 'folder' || node.glyph === 'Folder') {
        validRelativeKeys.add(`${safeTitle}/.keep`);
        validRelativeKeys.add(`${safeTitle}/README.md`);
      } else if (node.type === 'collection' || node.glyph === 'Kanban') {
        validRelativeKeys.add(`${safeTitle}/kanban_board.json`);
        const boardId = node.collectionId || node.id;
        const boardCols = data.categories.filter((c) => c.boardId === boardId);
        for (const col of boardCols) {
          const colFolder = getSafeCloudFolderName(col.title);
          validRelativeKeys.add(`${safeTitle}/${colFolder}/.keep`);
          validRelativeKeys.add(`${safeTitle}/${colFolder}/README.md`);
        }
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
          const boardFolder = getSafeCloudFolderName(boardNode?.title || 'Kanban');
          validRelativeKeys.add(`${boardFolder}/${catFolder}/${filename}`);
        } else {
          validRelativeKeys.add(`${catFolder}/${filename}`);
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

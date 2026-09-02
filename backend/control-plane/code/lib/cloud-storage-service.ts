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
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection, GraphNode, DocumentItem, DocCategory } from './types';
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
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: fullKey,
        })
      );
      return true;
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

  const manifest = {
    workspaceName,
    folderPrefix: cleanPrefix,
    provider: conn.provider,
    label: conn.label,
    initializedAt: new Date().toISOString(),
    owner: userName,
    ecosystem: 'ultrst',
    app: 'docustack',
    directories: ['inbox', 'active', 'vault', 'archive', 'engineering'],
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

  const initialCategories: DocCategory[] = [
    {
      id: 'cat-inbox',
      title: 'Inbox',
      description: 'Incoming unorganized documents & quick captures',
      glyph: 'Inbox',
      color: '#3B82F6',
    },
    {
      id: 'cat-active',
      title: 'Active Projects',
      description: 'Ongoing documents and active workspaces',
      glyph: 'Flame',
      color: '#F97316',
    },
    {
      id: 'cat-vault',
      title: 'Vault Archive',
      description: 'Long-term immutable knowledge storage',
      glyph: 'Archive',
      color: '#10B981',
    },
  ];

  const safeWsTitle = workspaceName.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const welcomeDocContent = `# ${workspaceName}

Welcome to **${workspaceName}**, powered by DocuStack and connected to your user-owned **${conn.label || conn.provider}** bucket.

- **Storage Provider**: ${conn.provider}
- **Canonical Folder**: \`${cleanPrefix}\`
- **Initialized**: ${new Date().toLocaleString()}
- **Ecosystem**: Ultrst Open Ecosystem

All markdown notes, graph structures, tags, and media uploaded here are saved directly into your cloud storage bucket.
`;

  const initialDocuments: DocumentItem[] = [
    {
      id: 'doc-welcome',
      categoryId: 'cat-inbox',
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

  // 2. Write graph.json with root node titled with workspaceName
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    '.docustack/graph.json',
    JSON.stringify({ nodes: [initialRootNode], edges: [], groups: [] }, null, 2),
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

  // 5. Write actual physical markdown file in inbox/
  await writeCloudWorkspaceFile(
    conn,
    cleanPrefix,
    `inbox/WELCOME_TO_${safeWsTitle}.MD`,
    welcomeDocContent,
    'text/markdown'
  );
  filesCreated.push(`inbox/WELCOME_TO_${safeWsTitle}.MD`);

  return { success: true, filesCreated };
}

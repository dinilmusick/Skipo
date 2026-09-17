import { UserStorageConnection } from '../types';
import { listCloudWorkspaceFiles } from './cloudStorageCore';
import { initializeCloudWorkspaceBucket } from './cloudStorageNodeSync';

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
    if (!cleanRel || cleanRel.startsWith('.docustack/') || cleanRel === '.docustack') continue;

    const parts = cleanRel.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const subRel = parts.slice(0, i + 1).join('/');

      if (isLast) {
        if (part === '.keep') continue;
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

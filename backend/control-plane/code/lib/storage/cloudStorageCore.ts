/**
 * @file cloudStorageCore.ts
 * @description Core Cloud Storage read/write/list/delete operations.
 * File size strictly <= 200 lines.
 */

import { PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection } from '../types';
import { buildS3Client } from '../storage-providers';
import { permanentDeleteS3Object } from './cloudStoragePermanentDelete';

export interface CloudStorageFileInfo {
  key: string;
  name: string;
  size?: number;
  lastModified?: Date;
}

export function buildKey(folderPrefix: string, relativePath: string): string {
  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  if (!relativePath || relativePath === '/' || relativePath === '') return `${cleanPrefix}/`;
  const cleanRel = relativePath.replace(/^\/+/g, '');
  return `${cleanPrefix}/${cleanRel}`;
}

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
    if (!url || !key || !bucket) throw new Error('MISSING_SUPABASE_CREDENTIALS');

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const fileBody = typeof content === 'string' ? new Blob([content], { type: contentType }) : content;
    const { error } = await supabase.storage.from(bucket).upload(fullKey, fileBody, { upsert: true, contentType });
    if (error) throw new Error(`Supabase Storage Write Error: ${error.message}`);
    return;
  }

  throw new Error(`UNSUPPORTED_CLOUD_STORAGE_PROVIDER: ${conn.provider}`);
}

export async function readCloudWorkspaceFile(
  conn: UserStorageConnection,
  folderPrefix: string,
  relativePath: string
): Promise<string | null> {
  const fullKey = buildKey(folderPrefix, relativePath);

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: fullKey }));
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
    if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.message?.includes('not found')) return null;
    throw err;
  }
  return null;
}

export async function listCloudWorkspaceFiles(
  conn: UserStorageConnection,
  folderPrefix: string,
  subDir?: string
): Promise<CloudStorageFileInfo[]> {
  const targetPrefix = subDir ? buildKey(folderPrefix, subDir) : folderPrefix.replace(/^\/+|\/+$/g, '') + '/';

  if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
    const { s3, bucketName } = buildS3Client(conn);
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: targetPrefix }));
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

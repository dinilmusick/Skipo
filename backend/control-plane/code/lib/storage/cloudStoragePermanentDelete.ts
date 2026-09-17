/**
 * @file cloudStoragePermanentDelete.ts
 * @description Permanent S3/Backblaze B2 object & directory deletion without ghost markers.
 * File size strictly <= 200 lines.
 */

import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection } from '../types';
import { buildS3Client } from '../storage-providers';

export async function permanentDeleteS3Object(
  s3: any,
  bucketName: string,
  fullKey: string
): Promise<boolean> {
  try {
    const versionsToDelete: { Key: string; VersionId?: string }[] = [];
    try {
      const versionsRes: any = await s3.send(
        new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: fullKey })
      );
      for (const v of versionsRes.Versions || []) {
        if (v.Key === fullKey) versionsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
      }
      for (const dm of versionsRes.DeleteMarkers || []) {
        if (dm.Key === fullKey) versionsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
      }
    } catch {}

    if (versionsToDelete.length > 0) {
      for (let i = 0; i < versionsToDelete.length; i += 1000) {
        const batch = versionsToDelete.slice(i, i + 1000);
        try {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: batch, Quiet: true } }));
        } catch {
          for (const item of batch) {
            try { await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: item.Key, VersionId: item.VersionId })); } catch {}
          }
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function permanentDeleteS3Folder(
  s3: any,
  bucketName: string,
  targetPrefix: string
): Promise<{ success: boolean; deletedCount: number }> {
  let deletedCount = 0;
  const barePrefix = targetPrefix.replace(/\/+$/, '');
  const isMatch = (k: string) => k === barePrefix || k === `${barePrefix}/` || k.startsWith(`${barePrefix}/`);

  try {
    let keyMarker: string | undefined = undefined;
    let versionIdMarker: string | undefined = undefined;
    let isTruncated = true;
    let versionsSupported = true;

    while (isTruncated && versionsSupported) {
      try {
        const input: any = { Bucket: bucketName, Prefix: barePrefix };
        if (keyMarker) input.KeyMarker = keyMarker;
        if (versionIdMarker && keyMarker) input.VersionIdMarker = versionIdMarker;

        const res: any = await s3.send(new ListObjectVersionsCommand(input));
        const items: { Key: string; VersionId?: string }[] = [];
        for (const v of res.Versions || []) if (v.Key && isMatch(v.Key)) items.push({ Key: v.Key, VersionId: v.VersionId });
        for (const dm of res.DeleteMarkers || []) if (dm.Key && isMatch(dm.Key)) items.push({ Key: dm.Key, VersionId: dm.VersionId });

        if (items.length > 0) {
          for (let i = 0; i < items.length; i += 1000) {
            const batch = items.slice(i, i + 1000);
            try {
              await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: batch, Quiet: true } }));
              deletedCount += batch.length;
            } catch {
              for (const it of batch) {
                try { await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: it.Key, VersionId: it.VersionId })); deletedCount++; } catch {}
              }
            }
          }
        }
        isTruncated = Boolean(res.IsTruncated);
        keyMarker = res.NextKeyMarker;
        versionIdMarker = res.NextVersionIdMarker;
      } catch {
        versionsSupported = false;
      }
    }
    return { success: true, deletedCount };
  } catch {
    return { success: false, deletedCount: 0 };
  }
}

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
      return await permanentDeleteS3Folder(s3, bucketName, bareKey);
    }
    if (conn.provider === 'supabase_storage') {
      const supabase = createClient((conn.supabaseUrl || '').trim(), (conn.supabaseServiceKey || conn.supabaseAnonKey || '').trim(), { auth: { persistSession: false } });
      const { data } = await supabase.storage.from((conn.supabaseBucketName || '').trim()).list(targetPrefix);
      if (data && data.length > 0) {
        const keys = data.map((item) => `${targetPrefix}${item.name}`);
        await supabase.storage.from((conn.supabaseBucketName || '').trim()).remove(keys);
        return { success: true, deletedCount: keys.length };
      }
      return { success: true, deletedCount: 0 };
    }
  } catch {
    return { success: false, deletedCount: 0 };
  }
  return { success: false, deletedCount: 0 };
}

export async function renameCloudWorkspaceFolder(
  conn: UserStorageConnection,
  folderPrefix: string,
  oldRelativePath: string,
  newRelativePath: string
): Promise<{ success: boolean; movedCount: number }> {
  const oldClean = oldRelativePath.replace(/^\/+|\/+$/g, '');
  const newClean = newRelativePath.replace(/^\/+|\/+$/g, '');
  if (!oldClean || !newClean || oldClean === newClean) return { success: false, movedCount: 0 };

  const cleanPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');
  const oldFolderKey = `${cleanPrefix}/${oldClean}`;
  const oldFolderPrefix = `${cleanPrefix}/${oldClean}/`;
  const newFolderPrefix = `${cleanPrefix}/${newClean}/`;
  let movedCount = 0;

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      const listRes: any = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: oldFolderKey }));
      for (const obj of listRes.Contents || []) {
        if (!obj.Key || obj.Key.endsWith('/')) continue;
        const subRel = obj.Key.startsWith(oldFolderPrefix) ? obj.Key.substring(oldFolderPrefix.length) : '';
        if (!subRel) continue;
        const newKey = `${newFolderPrefix}${subRel}`;
        const getRes = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: obj.Key }));
        if (getRes.Body) {
          const bytes = await getRes.Body.transformToByteArray();
          await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: newKey, Body: bytes, ContentType: getRes.ContentType || 'application/octet-stream' }));
          movedCount++;
        }
      }
      await permanentDeleteS3Folder(s3, bucketName, oldFolderKey);
      return { success: true, movedCount };
    }
  } catch {}
  return { success: false, movedCount: 0 };
}

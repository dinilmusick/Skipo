import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { UserStorageConnection } from '../types';
import { buildS3Client } from '../storage-providers';

export interface PresignedUploadOptions {
  conn: UserStorageConnection;
  objectKey: string;
  contentType: string;
  maxSizeBytes?: number;
  expiresInSeconds?: number;
}

export interface PresignedDownloadOptions {
  conn: UserStorageConnection;
  objectKey: string;
  expiresInSeconds?: number;
}

export function sanitizeStorageKey(workspaceId: string, relativePath: string): string {
  const cleanWs = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanPath = relativePath.replace(/^\/+/, '').replace(/\.\./g, '');
  return `workspaces/${cleanWs}/${cleanPath}`;
}

export async function createPresignedUploadUrl(
  options: PresignedUploadOptions
): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
  const { conn, objectKey, contentType, expiresInSeconds = 900 } = options;
  const { s3, bucketName } = buildS3Client(conn);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  return { uploadUrl, objectKey, expiresIn: expiresInSeconds };
}

export async function createPresignedDownloadUrl(
  options: PresignedDownloadOptions
): Promise<{ downloadUrl: string; expiresIn: number }> {
  const { conn, objectKey, expiresInSeconds = 900 } = options;
  const { s3, bucketName } = buildS3Client(conn);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  const downloadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  return { downloadUrl, expiresIn: expiresInSeconds };
}

export async function deleteStorageObject(
  conn: UserStorageConnection,
  objectKey: string
): Promise<boolean> {
  const { s3, bucketName } = buildS3Client(conn);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  );
  return true;
}

export async function initiateMultipartUpload(
  conn: UserStorageConnection,
  objectKey: string,
  contentType: string
): Promise<{ uploadId: string; objectKey: string }> {
  const { s3, bucketName } = buildS3Client(conn);
  const res = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  if (!res.UploadId) throw new Error('MULTIPART_INIT_FAILED');
  return { uploadId: res.UploadId, objectKey };
}

export async function getMultipartPartUrl(
  conn: UserStorageConnection,
  objectKey: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const { s3, bucketName } = buildS3Client(conn);
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: objectKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function completeMultipartUpload(
  conn: UserStorageConnection,
  objectKey: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<boolean> {
  const { s3, bucketName } = buildS3Client(conn);
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    })
  );
  return true;
}

/**
 * Storage Providers Engine — S3-Compatible & Supabase Storage Client & Connectivity Prober
 *
 * Supports:
 * - Backblaze B2 (10GB Free Tier, S3-Compatible)
 * - Cloudflare R2 (10GB/mo Free Tier, Zero Egress, S3-Compatible)
 * - AWS S3 (Standard S3)
 * - Supabase Storage (1GB Free Tier, REST API)
 * - Local Folder (Browser File System Access API)
 *
 * All credentials are user-owned and stored in the user profile in the system database.
 */

import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { UserStorageConnection, UserStorageProvider } from './types';

export interface StorageFieldDef {
  key: keyof UserStorageConnection;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  helpText?: string;
  required?: boolean;
}

export interface StorageProviderMeta {
  id: UserStorageProvider;
  name: string;
  shortName: string;
  tag: string;
  color: string;
  freeTier: string;
  description: string;
  fields: StorageFieldDef[];
  isS3Compatible?: boolean;
  browserOnly?: boolean;
}

export const STORAGE_PROVIDER_CONFIGS: Record<UserStorageProvider, StorageProviderMeta> = {
  local_fs: {
    id: 'local_fs',
    name: 'LOCAL DISK FOLDER',
    shortName: 'Local Folder',
    tag: 'BROWSER DISK',
    color: '#D4AF37',
    freeTier: 'Unlimited (Your own disk)',
    description: 'Select any folder on your computer. Uses native browser File System API with IndexedDB persistence.',
    browserOnly: true,
    fields: [],
  },
  backblaze_b2: {
    id: 'backblaze_b2',
    name: 'BACKBLAZE B2 CLOUD',
    shortName: 'Backblaze B2',
    tag: '10 GB FREE',
    color: '#E11D48',
    freeTier: '10 GB free forever · $0.006/GB after',
    description: 'High performance S3-compatible cloud storage. Get Key ID & Application Key from Backblaze B2 Console.',
    isS3Compatible: true,
    fields: [
      {
        key: 'b2KeyId',
        label: 'Key ID (Access Key ID)',
        type: 'text',
        placeholder: '004a1b2c3d...',
        helpText: 'From Backblaze B2 -> App Keys -> keyID',
        required: true,
      },
      {
        key: 'b2ApplicationKey',
        label: 'Application Key (Secret Key)',
        type: 'password',
        placeholder: 'K004xXyYzZ...',
        helpText: 'The secret key shown when creating your B2 App Key',
        required: true,
      },
      {
        key: 'b2BucketName',
        label: 'Bucket Name',
        type: 'text',
        placeholder: 'my-docustack-vault',
        helpText: 'The exact bucket name created in your Backblaze account',
        required: true,
      },
      {
        key: 'b2Region',
        label: 'Endpoint Region (Optional)',
        type: 'text',
        placeholder: 'us-west-004',
        helpText: 'Region prefix from your bucket S3 endpoint (defaults to us-west-004)',
      },
    ],
  },
  cloudflare_r2: {
    id: 'cloudflare_r2',
    name: 'CLOUDFLARE R2 STORAGE',
    shortName: 'Cloudflare R2',
    tag: 'ZERO EGRESS',
    color: '#F59E0B',
    freeTier: '10 GB/mo free · $0 egress fees forever',
    description: 'Fast globally distributed object storage with zero egress fees. S3-compatible API.',
    isS3Compatible: true,
    fields: [
      {
        key: 'r2AccountId',
        label: 'Cloudflare Account ID',
        type: 'text',
        placeholder: 'a1b2c3d4e5f6...',
        helpText: 'Found on the right sidebar of your Cloudflare dashboard overview',
        required: true,
      },
      {
        key: 'r2AccessKeyId',
        label: 'R2 Access Key ID',
        type: 'text',
        placeholder: '7a8b9c0d1e...',
        helpText: 'From Cloudflare R2 -> Manage R2 API Tokens',
        required: true,
      },
      {
        key: 'r2SecretAccessKey',
        label: 'R2 Secret Access Key',
        type: 'password',
        placeholder: '8f9e0d1c2b3a...',
        helpText: 'The secret token shown once when creating your R2 token',
        required: true,
      },
      {
        key: 'r2BucketName',
        label: 'Bucket Name',
        type: 'text',
        placeholder: 'docustack-r2-vault',
        helpText: 'The bucket created in your Cloudflare R2 dashboard',
        required: true,
      },
    ],
  },
  aws_s3: {
    id: 'aws_s3',
    name: 'AMAZON AWS S3',
    shortName: 'AWS S3',
    tag: 'ENTERPRISE CLOUD',
    color: '#EC4899',
    freeTier: '5 GB free tier for 12 months',
    description: 'Standard Amazon Web Services Simple Storage Service (S3) or any custom S3-compatible gateway.',
    isS3Compatible: true,
    fields: [
      {
        key: 's3AccessKeyId',
        label: 'AWS Access Key ID',
        type: 'text',
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        helpText: 'From AWS IAM -> Users -> Security credentials',
        required: true,
      },
      {
        key: 's3SecretAccessKey',
        label: 'AWS Secret Access Key',
        type: 'password',
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        helpText: 'The secret access key generated in IAM',
        required: true,
      },
      {
        key: 's3BucketName',
        label: 'S3 Bucket Name',
        type: 'text',
        placeholder: 'my-s3-vault',
        helpText: 'The S3 bucket name created in AWS S3 console',
        required: true,
      },
      {
        key: 's3Region',
        label: 'AWS Region',
        type: 'text',
        placeholder: 'us-east-1',
        helpText: 'e.g. us-east-1, eu-west-1, ap-southeast-1',
        required: true,
      },
      {
        key: 's3Endpoint',
        label: 'Custom S3 Endpoint (Optional)',
        type: 'text',
        placeholder: 'https://minio.yourdomain.com',
        helpText: 'Leave blank for standard AWS S3, or specify for MinIO / Wasabi / local gateways',
      },
    ],
  },
  supabase_storage: {
    id: 'supabase_storage',
    name: 'SUPABASE STORAGE',
    shortName: 'Supabase Storage',
    tag: '1 GB FREE',
    color: '#10B981',
    freeTier: '1 GB free storage per project',
    description: 'Direct integration with Supabase Object Storage bucket using your project URL and API key.',
    fields: [
      {
        key: 'supabaseUrl',
        label: 'Supabase Project URL',
        type: 'text',
        placeholder: 'https://xyzcompany.supabase.co',
        helpText: 'From Supabase Project Settings -> API -> Project URL',
        required: true,
      },
      {
        key: 'supabaseAnonKey',
        label: 'Supabase Anon or Service Key',
        type: 'password',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        helpText: 'Project Settings -> API -> anon public key (or service_role key for private buckets)',
        required: true,
      },
      {
        key: 'supabaseBucketName',
        label: 'Storage Bucket Name',
        type: 'text',
        placeholder: 'docustack-vault',
        helpText: 'The storage bucket name created in Supabase -> Storage',
        required: true,
      },
    ],
  },
  google_drive: {
    id: 'google_drive',
    name: 'GOOGLE DRIVE WORKSPACE',
    shortName: 'Google Drive',
    tag: '15 GB FREE',
    color: '#3B82F6',
    freeTier: '15 GB shared Google account quota',
    description: 'OAuth 2.0 connection to personal Google Drive with canonical folder synchronization.',
    fields: [],
  },
  icloud: {
    id: 'icloud',
    name: 'APPLE ICLOUD DRIVE',
    shortName: 'iCloud Drive',
    tag: 'APPLE ECOSYSTEM',
    color: '#60A5FA',
    freeTier: '5 GB free Apple quota',
    description: 'Native Apple CloudKit container integration.',
    fields: [],
  },
  onedrive: {
    id: 'onedrive',
    name: 'MICROSOFT ONEDRIVE',
    shortName: 'OneDrive',
    tag: 'MICROSOFT 365',
    color: '#0284C7',
    freeTier: '5 GB free Microsoft quota',
    description: 'Microsoft Graph API cloud synchronization.',
    fields: [],
  },
  s3_blob: {
    id: 's3_blob',
    name: 'GENERIC S3 / BLOB ADAPTER',
    shortName: 'Generic S3',
    tag: 'CUSTOM BLOB',
    color: '#8B5CF6',
    freeTier: 'Custom provider dependent',
    description: 'Generic S3 endpoint adapter for self-hosted MinIO or object storage.',
    fields: [],
  },
  firebase: {
    id: 'firebase',
    name: 'FIREBASE CLOUD STORAGE',
    shortName: 'Firebase Storage',
    tag: 'GCP CLOUD',
    color: '#F97316',
    freeTier: '5 GB free GCP quota',
    description: 'Google Cloud Platform bucket via Firebase Storage adapter.',
    fields: [],
  },
};

/**
 * Build S3Client instance for Backblaze B2, Cloudflare R2, or AWS S3
 */
export function buildS3Client(conn: UserStorageConnection): { s3: S3Client; bucketName: string } {
  if (conn.provider === 'backblaze_b2') {
    const keyId = (conn.b2KeyId || '').trim();
    const appKey = (conn.b2ApplicationKey || '').trim();
    const bucket = (conn.b2BucketName || '').trim();
    const region = (conn.b2Region || 'us-west-004').trim();

    if (!keyId || !appKey || !bucket) {
      throw new Error('MISSING_BACKBLAZE_CREDENTIALS: Key ID, Application Key, and Bucket Name are required.');
    }

    const s3 = new S3Client({
      region,
      endpoint: `https://s3.${region}.backblazeb2.com`,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });

    return { s3, bucketName: bucket };
  }

  if (conn.provider === 'cloudflare_r2') {
    const accountId = (conn.r2AccountId || '').trim();
    const accessKey = (conn.r2AccessKeyId || '').trim();
    const secretKey = (conn.r2SecretAccessKey || '').trim();
    const bucket = (conn.r2BucketName || '').trim();

    if (!accountId || !accessKey || !secretKey || !bucket) {
      throw new Error('MISSING_R2_CREDENTIALS: Account ID, Access Key ID, Secret Access Key, and Bucket Name are required.');
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    return { s3, bucketName: bucket };
  }

  if (conn.provider === 'aws_s3') {
    const accessKey = (conn.s3AccessKeyId || '').trim();
    const secretKey = (conn.s3SecretAccessKey || '').trim();
    const bucket = (conn.s3BucketName || '').trim();
    const region = (conn.s3Region || 'us-east-1').trim();
    const endpoint = (conn.s3Endpoint || '').trim() || undefined;

    if (!accessKey || !secretKey || !bucket) {
      throw new Error('MISSING_AWS_S3_CREDENTIALS: Access Key ID, Secret Access Key, and Bucket Name are required.');
    }

    const s3 = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    return { s3, bucketName: bucket };
  }

  throw new Error(`PROVIDER_NOT_S3_COMPATIBLE: ${conn.provider} is not an S3-compatible provider.`);
}

/**
 * Live connectivity prober for user-configured storage connection
 */
export async function testStorageConnection(
  conn: UserStorageConnection
): Promise<{ ok: boolean; latencyMs: number; error?: string; details?: any }> {
  const start = performance.now();

  try {
    if (conn.provider === 'backblaze_b2' || conn.provider === 'cloudflare_r2' || conn.provider === 'aws_s3') {
      const { s3, bucketName } = buildS3Client(conn);
      // Run a lightweight ListObjectsV2Command (MaxKeys: 1) to verify both read access and bucket existence
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1,
        })
      );

      const latencyMs = Math.round(performance.now() - start);
      return {
        ok: true,
        latencyMs,
        details: {
          bucket: bucketName,
          keyCount: res.KeyCount ?? 0,
        },
      };
    }

    if (conn.provider === 'supabase_storage') {
      const url = (conn.supabaseUrl || '').trim();
      const key = (conn.supabaseAnonKey || conn.supabaseServiceKey || '').trim();
      const bucket = (conn.supabaseBucketName || '').trim();

      if (!url || !key || !bucket) {
        throw new Error('MISSING_SUPABASE_CREDENTIALS: URL, Key, and Bucket Name are required.');
      }

      const supabase = createClient(url, key, {
        auth: { persistSession: false },
      });

      // Test listing files in the bucket root
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1 });
      if (error) {
        throw new Error(`Supabase Storage Error: ${error.message}`);
      }

      const latencyMs = Math.round(performance.now() - start);
      return {
        ok: true,
        latencyMs,
        details: {
          bucket,
          fileCount: data?.length ?? 0,
        },
      };
    }

    if (conn.provider === 'local_fs') {
      return {
        ok: true,
        latencyMs: 0,
        details: { note: 'Local folder handles verified in browser' },
      };
    }

    throw new Error(`PROBING_NOT_IMPLEMENTED: Connectivity test not supported for provider '${conn.provider}'.`);
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      latencyMs,
      error: err?.message || 'Storage connection probe failed',
    };
  }
}

/**
 * Mask secret credentials in a UserStorageConnection before returning to client UI
 */
export function maskStorageConnection(conn: UserStorageConnection): UserStorageConnection {
  const mask = (str?: string) => (str && str.length > 6 ? `${str.slice(0, 3)}••••${str.slice(-3)}` : '••••••••');

  return {
    ...conn,
    b2ApplicationKey: conn.b2ApplicationKey ? mask(conn.b2ApplicationKey) : undefined,
    r2SecretAccessKey: conn.r2SecretAccessKey ? mask(conn.r2SecretAccessKey) : undefined,
    s3SecretAccessKey: conn.s3SecretAccessKey ? mask(conn.s3SecretAccessKey) : undefined,
    supabaseAnonKey: conn.supabaseAnonKey ? mask(conn.supabaseAnonKey) : undefined,
    supabaseServiceKey: conn.supabaseServiceKey ? mask(conn.supabaseServiceKey) : undefined,
  };
}

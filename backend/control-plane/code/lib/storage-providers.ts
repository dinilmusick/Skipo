/**
 * Storage Providers Engine — S3-Compatible & Supabase Storage Client & Connectivity Prober
 *
 * Supported Storage Engines:
 * - Local Folder (Browser File System Access API)
 * - Backblaze B2 (S3-Compatible)
 * - Cloudflare R2 (S3-Compatible)
 * - Supabase Storage (REST API)
 * - AWS S3 (Standard S3)
 *
 * All credentials are user-owned and stored in the user profile in the system database.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import {
  UserStorageConnection,
  UserStorageProvider,
  UltrstStorageExport,
  UltrstStorageBundleExport,
} from './types';

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
    tag: 'LOCAL DISK',
    color: '#D4AF37',
    description: 'Select any folder on your computer. Uses native browser File System API with IndexedDB persistence.',
    browserOnly: true,
    fields: [],
  },
  backblaze_b2: {
    id: 'backblaze_b2',
    name: 'BACKBLAZE B2',
    shortName: 'Backblaze B2',
    tag: 'S3 STORAGE',
    color: '#E11D48',
    description: 'S3-compatible cloud bucket. Provide your Key ID & Application Key from Backblaze B2 Console.',
    isS3Compatible: true,
    fields: [
      {
        key: 'b2KeyId',
        label: 'Key ID (Access Key ID)',
        type: 'text',
        placeholder: '005a1b2c3d...',
        helpText: 'From Backblaze B2 -> Application Keys -> keyID (25 characters, e.g. 005...)',
        required: true,
      },
      {
        key: 'b2ApplicationKey',
        label: 'Application Key (Secret Key)',
        type: 'password',
        placeholder: 'K005xXyYzZ...',
        helpText: 'The secret key shown when creating your B2 App Key (31 characters, starts with K00...)',
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
        key: 'b2Endpoint',
        label: 'B2 S3 Endpoint (Optional)',
        type: 'text',
        placeholder: 's3.us-east-005.backblazeb2.com',
        helpText: 'From Backblaze B2 -> Buckets -> Endpoint. Auto-derived from Key ID if omitted.',
        required: false,
      },
    ],
  },
  cloudflare_r2: {
    id: 'cloudflare_r2',
    name: 'CLOUDFLARE R2',
    shortName: 'Cloudflare R2',
    tag: 'S3 STORAGE',
    color: '#F59E0B',
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
  supabase_storage: {
    id: 'supabase_storage',
    name: 'SUPABASE STORAGE',
    shortName: 'Supabase Storage',
    tag: 'REST STORAGE',
    color: '#10B981',
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
  aws_s3: {
    id: 'aws_s3',
    name: 'AWS S3',
    shortName: 'AWS S3',
    tag: 'AWS S3',
    color: '#EC4899',
    description: 'Amazon Web Services Simple Storage Service (S3) or any custom S3-compatible gateway.',
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
};

/**
 * Intelligently resolve Backblaze B2 S3 endpoint and region
 * Supports:
 * - Full endpoint URLs: e.g. "s3.us-east-005.backblazeb2.com" or "https://s3.us-east-005.backblazeb2.com"
 * - Region names: e.g. "us-east-005", "us-west-004", "eu-central-003"
 * - Auto-detection from Key ID prefix:
 *   005... -> us-east-005
 *   004... -> us-west-004
 *   003... -> eu-central-003
 *   002... -> us-west-002
 *   001... -> us-west-001
 *   000... -> us-west-000
 */
export function resolveBackblazeEndpoint(
  inputEndpointOrRegion?: string,
  keyId?: string
): { endpoint: string; region: string } {
  let raw = (inputEndpointOrRegion || '').trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  // 1. Full B2 S3 Endpoint: "s3.us-east-005.backblazeb2.com"
  const endpointMatch = raw.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (endpointMatch) {
    return {
      region: endpointMatch[1],
      endpoint: `https://${raw}`,
    };
  }

  // 2. Region name entered directly: "us-east-005"
  if (raw && /^[a-z0-9-]+$/.test(raw) && !raw.includes('.')) {
    return {
      region: raw,
      endpoint: `https://s3.${raw}.backblazeb2.com`,
    };
  }

  // 3. Custom gateway: e.g. proxy.mydomain.com
  if (raw && raw.includes('.')) {
    return {
      region: 'us-west-004',
      endpoint: `https://${raw}`,
    };
  }

  // 4. Auto-detect region from Key ID prefix
  let derivedRegion = 'us-west-004';
  if (keyId) {
    const cleanKey = keyId.trim();
    if (cleanKey.startsWith('005')) derivedRegion = 'us-east-005';
    else if (cleanKey.startsWith('004')) derivedRegion = 'us-west-004';
    else if (cleanKey.startsWith('003')) derivedRegion = 'eu-central-003';
    else if (cleanKey.startsWith('002')) derivedRegion = 'us-west-002';
    else if (cleanKey.startsWith('001')) derivedRegion = 'us-west-001';
    else if (cleanKey.startsWith('000')) derivedRegion = 'us-west-000';
  }

  return {
    region: derivedRegion,
    endpoint: `https://s3.${derivedRegion}.backblazeb2.com`,
  };
}

/**
 * Build S3Client instance for Backblaze B2, Cloudflare R2, or AWS S3
 */
export function buildS3Client(conn: UserStorageConnection): { s3: S3Client; bucketName: string } {
  if (conn.provider === 'backblaze_b2') {
    let keyId = (conn.b2KeyId || '').trim();
    let appKey = (conn.b2ApplicationKey || '').trim();
    const bucket = (conn.b2BucketName || '').trim();

    // 1. Auto-extract if user pasted multi-line block containing "keyID: ... applicationKey: ..."
    const rawCombined = `${keyId}\n${appKey}`;
    const idMatch = rawCombined.match(/keyID[:\s]+([0-9a-fA-F]{12,32})/i);
    const secretMatch = rawCombined.match(/applicationKey[:\s]+([0-9a-zA-Z]{20,40})/i);
    if (idMatch && secretMatch) {
      keyId = idMatch[1].trim();
      appKey = secretMatch[1].trim();
    }

    // 2. Auto-detect if user swapped Key ID and Application Key
    // (B2 Application Key secret starts with 'K00' and is 31 chars; Key ID is 25 chars starting with '00')
    if (keyId.startsWith('K00') && (!appKey || appKey.startsWith('00') || appKey.length === 25)) {
      const temp = keyId;
      keyId = appKey || temp;
      appKey = temp;
    }

    if (!keyId || !appKey || !bucket) {
      throw new Error('MISSING_BACKBLAZE_CREDENTIALS: Key ID, Application Key, and Bucket Name are required.');
    }

    const { endpoint, region } = resolveBackblazeEndpoint(conn.b2Endpoint || conn.b2Region, keyId);

    const s3 = new S3Client({
      region,
      endpoint,
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
    let errorMessage = err?.message || 'Storage connection probe failed';

    if (conn.provider === 'backblaze_b2') {
      if (err.name === 'InvalidAccessKeyId' || errorMessage.includes('not valid') || errorMessage.includes('Malformed')) {
        errorMessage = `Backblaze B2 rejected the Key ID. Check:
1. Make sure you entered the 25-character 'keyID' (starts with 000-005) and NOT the Key Name.
2. In Backblaze B2 -> Buckets, check the 'Endpoint' of your bucket (e.g. s3.us-east-005.backblazeb2.com) and paste it into the S3 Endpoint field.
3. If your key was restricted to a specific bucket when created, make sure the Bucket Name matches exactly.`;
      }
    }

    return {
      ok: false,
      latencyMs,
      error: errorMessage,
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

/**
 * Universal Ultrst JSON Export Helper
 */
export function exportStorageConnectionToJson(
  conn: UserStorageConnection,
  appName: string = 'docustack'
): UltrstStorageExport {
  return {
    $schema: 'https://ultrst.org/schemas/storage-config.v1.json',
    version: 1,
    ecosystem: 'ultrst',
    exportedAt: new Date().toISOString(),
    appName,
    storage: conn,
  };
}

/**
 * Universal Ultrst JSON Bundle Export Helper
 */
export function exportStorageBundleToJson(
  connections: UserStorageConnection[],
  appName: string = 'docustack'
): UltrstStorageBundleExport {
  return {
    $schema: 'https://ultrst.org/schemas/storage-bundle.v1.json',
    version: 1,
    ecosystem: 'ultrst',
    exportedAt: new Date().toISOString(),
    appName,
    connections,
  };
}

/**
 * Universal Ultrst JSON Import Parser
 */
export function parseStorageImportJson(jsonText: string): {
  isBundle: boolean;
  connection?: UserStorageConnection;
  connections?: UserStorageConnection[];
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed.connections)) {
      return { isBundle: true, connections: parsed.connections };
    }
    if (parsed.storage && parsed.storage.provider) {
      return { isBundle: false, connection: parsed.storage };
    }
    if (parsed.provider) {
      return { isBundle: false, connection: parsed };
    }
    throw new Error('Unrecognized JSON structure.');
  } catch (err: any) {
    throw new Error(`INVALID_STORAGE_CONFIG_JSON: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Workspace Storage Deep-Link Resolver (Law L17 & Law L18 & Law L19)
// ══════════════════════════════════════════════════════════════════════════════

export interface StorageLinkInfo {
  provider: string;
  isCloud: boolean;
  actionUrl: string | null;
  targetDisplay: string;
  buttonLabel: string; // <= 4 words
  description: string; // D+Hover description
}

export interface MinimalWorkspaceRecord {
  id: string;
  name: string;
  storageProvider?: string;
  storageConnectionId?: string;
  localFolderName?: string;
  localFolderKey?: string;
  workspacePath?: string;
}

export interface MinimalStorageConnection {
  id: string;
  provider: string;
  label: string;
  b2BucketName?: string;
  b2Endpoint?: string;
  b2Region?: string;
  s3BucketName?: string;
  s3Region?: string;
  r2AccountId?: string;
  r2BucketName?: string;
  supabaseUrl?: string;
  supabaseBucketName?: string;
  localFolderKey?: string;
  localFolderName?: string;
  localFolderPathHint?: string;
}

export function getWorkspaceStorageLink(
  ws: MinimalWorkspaceRecord,
  conn?: MinimalStorageConnection
): StorageLinkInfo {
  const provider = ws.storageProvider || conn?.provider || 'local_fs';

  if (provider === 'backblaze_b2') {
    const bucket = conn?.b2BucketName || 'b2-bucket';
    return {
      provider,
      isCloud: true,
      actionUrl: 'https://secure.backblaze.com/b2_buckets.htm',
      targetDisplay: bucket,
      buttonLabel: 'OPEN B2 BUCKET',
      description: `Open Backblaze B2 web console for bucket ${bucket}.`,
    };
  }

  if (provider === 'aws_s3') {
    const bucket = conn?.s3BucketName || 's3-bucket';
    const region = conn?.s3Region || 'us-east-1';
    return {
      provider,
      isCloud: true,
      actionUrl: `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}`,
      targetDisplay: bucket,
      buttonLabel: 'OPEN S3 BUCKET',
      description: `Open AWS S3 console for bucket ${bucket} in region ${region}.`,
    };
  }

  if (provider === 'cloudflare_r2') {
    const bucket = conn?.r2BucketName || 'r2-bucket';
    const account = conn?.r2AccountId;
    const url = account
      ? `https://dash.cloudflare.com/${account}/r2/default/buckets/${bucket}`
      : 'https://dash.cloudflare.com/?to=/:account/r2/default/buckets/' + bucket;
    return {
      provider,
      isCloud: true,
      actionUrl: url,
      targetDisplay: bucket,
      buttonLabel: 'OPEN R2 BUCKET',
      description: `Open Cloudflare R2 dashboard for bucket ${bucket}.`,
    };
  }

  if (provider === 'supabase_storage') {
    const bucket = conn?.supabaseBucketName || 'storage';
    const supaUrl = conn?.supabaseUrl ? conn.supabaseUrl.replace(/\/$/, '') : '';
    const url = supaUrl ? `${supaUrl}/project/_/storage/buckets/${bucket}` : 'https://supabase.com/dashboard';
    return {
      provider,
      isCloud: true,
      actionUrl: url,
      targetDisplay: bucket,
      buttonLabel: 'OPEN SUPABASE BUCKET',
      description: `Open Supabase storage bucket ${bucket} in project dashboard.`,
    };
  }

  // Fallback / default: local_fs
  const folder = ws.localFolderName || conn?.localFolderName || ws.workspacePath || ws.name;
  return {
    provider: 'local_fs',
    isCloud: false,
    actionUrl: null,
    targetDisplay: folder,
    buttonLabel: 'REVEAL LOCAL FOLDER',
    description: `Inspect and reveal workspace directory ${folder} in local filesystem.`,
  };
}

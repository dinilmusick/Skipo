import { neon } from '@neondatabase/serverless';

export interface UltrstCredentials {
  id: string;
  category: string;
  name: string;
  admin_email?: string;
  admin_password?: string;
  bucket_provider?: string;
  bucket_name?: string;
  bucket_endpoint?: string;
  bucket_region?: string;
  bucket_access_key_id?: string;
  bucket_secret_access_key?: string;
  bucket_public_url?: string;
  credentials?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

let inMemoryCredentialsCache: UltrstCredentials | null = null;
let cacheExpiryTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export function getSystemDatabaseUrls(): string[] {
  const rawUrls = [
    process.env.SYSTEM_DATABASE_URL_1,
    process.env.SYSTEM_DATABASE_URL_2,
    process.env.SYSTEM_DATABASE_URL_3,
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL,
  ];
  const cleaned: string[] = [];
  for (const raw of rawUrls) {
    const val = (raw || '').trim().replace(/^["']|["']$/g, '');
    if (val && !cleaned.includes(val)) {
      cleaned.push(val);
    }
  }
  return cleaned;
}

export async function autoProvisionCredentialsTable(
  connectionString: string
): Promise<{ success: boolean; message: string }> {
  const rawConn = connectionString?.trim().replace(/^["']|["']$/g, '');
  if (!rawConn) throw new Error('Database connection string required');
  const sql: any = neon(rawConn);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS public."ultrst_credentials" (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'system',
      name TEXT NOT NULL DEFAULT 'default',
      admin_email TEXT,
      admin_password TEXT,
      bucket_provider TEXT DEFAULT 's3',
      bucket_name TEXT,
      bucket_endpoint TEXT,
      bucket_region TEXT,
      bucket_access_key_id TEXT,
      bucket_secret_access_key TEXT,
      bucket_public_url TEXT,
      credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await sql.query(
    `SELECT id FROM public."ultrst_credentials" WHERE id = 'system' LIMIT 1;`
  );
  if (!existing || existing.length === 0) {
    await sql.query(`
      INSERT INTO public."ultrst_credentials" (
        id, category, name, admin_email, admin_password,
        bucket_provider, bucket_name, bucket_endpoint, bucket_region,
        bucket_access_key_id, bucket_secret_access_key, bucket_public_url,
        credentials
      ) VALUES (
        'system', 'system', 'Ultrst System Master Infrastructure',
        'admin@oracle.com', 'adminpassword123',
        's3', 'ultrst-system-bucket', 'https://s3.us-east-1.amazonaws.com', 'us-east-1',
        '', '', '',
        '{}'::jsonb
      );
    `);
  }

  return { success: true, message: 'ultrst_credentials table provisioned' };
}

export async function getSystemCredentials(
  targetId: string = 'system',
  forceRefresh = false
): Promise<UltrstCredentials | null> {
  const now = Date.now();
  if (!forceRefresh && inMemoryCredentialsCache && now < cacheExpiryTimestamp) {
    return inMemoryCredentialsCache;
  }

  const urls = getSystemDatabaseUrls();
  for (const connStr of urls) {
    try {
      const sql: any = neon(connStr);
      const rows: any[] = await sql.query(
        `SELECT * FROM public."ultrst_credentials" WHERE id = $1 LIMIT 1;`,
        [targetId]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        let creds = {};
        if (typeof row.credentials === 'string') {
          try { creds = JSON.parse(row.credentials); } catch {}
        } else if (typeof row.credentials === 'object' && row.credentials !== null) {
          creds = row.credentials;
        }

        const parsed: UltrstCredentials = {
          id: row.id,
          category: row.category,
          name: row.name,
          admin_email: row.admin_email,
          admin_password: row.admin_password,
          bucket_provider: row.bucket_provider || 's3',
          bucket_name: row.bucket_name,
          bucket_endpoint: row.bucket_endpoint,
          bucket_region: row.bucket_region,
          bucket_access_key_id: row.bucket_access_key_id,
          bucket_secret_access_key: row.bucket_secret_access_key,
          bucket_public_url: row.bucket_public_url,
          credentials: creds,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        };
        inMemoryCredentialsCache = parsed;
        cacheExpiryTimestamp = now + CACHE_TTL_MS;
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return inMemoryCredentialsCache;
}

export async function saveSystemCredentials(
  updates: Partial<UltrstCredentials>,
  targetId: string = 'system'
): Promise<UltrstCredentials> {
  const urls = getSystemDatabaseUrls();
  if (urls.length === 0) throw new Error('No system database available');

  const current = (await getSystemCredentials(targetId, true)) || {
    id: targetId,
    category: 'system',
    name: 'Ultrst System Master Infrastructure',
  };

  const merged: UltrstCredentials = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  for (const connStr of urls) {
    try {
      const sql: any = neon(connStr);
      await sql.query(
        `INSERT INTO public."ultrst_credentials" (
          id, category, name, admin_email, admin_password,
          bucket_provider, bucket_name, bucket_endpoint, bucket_region,
          bucket_access_key_id, bucket_secret_access_key, bucket_public_url,
          credentials, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          name = EXCLUDED.name,
          admin_email = EXCLUDED.admin_email,
          admin_password = EXCLUDED.admin_password,
          bucket_provider = EXCLUDED.bucket_provider,
          bucket_name = EXCLUDED.bucket_name,
          bucket_endpoint = EXCLUDED.bucket_endpoint,
          bucket_region = EXCLUDED.bucket_region,
          bucket_access_key_id = EXCLUDED.bucket_access_key_id,
          bucket_secret_access_key = EXCLUDED.bucket_secret_access_key,
          bucket_public_url = EXCLUDED.bucket_public_url,
          credentials = EXCLUDED.credentials,
          updated_at = NOW();`,
        [
          merged.id,
          merged.category || 'system',
          merged.name || 'default',
          merged.admin_email || null,
          merged.admin_password || null,
          merged.bucket_provider || 's3',
          merged.bucket_name || null,
          merged.bucket_endpoint || null,
          merged.bucket_region || null,
          merged.bucket_access_key_id || null,
          merged.bucket_secret_access_key || null,
          merged.bucket_public_url || null,
          JSON.stringify(merged.credentials || {}),
        ]
      );
    } catch (err: any) {
      console.warn(`[SystemCredentials] Sync to cluster node failed:`, err.message);
    }
  }

  inMemoryCredentialsCache = merged;
  cacheExpiryTimestamp = Date.now() + CACHE_TTL_MS;
  return merged;
}

export function getSystemAdminCredentialsSync(): { email: string; password: string } {
  if (inMemoryCredentialsCache?.admin_email && inMemoryCredentialsCache?.admin_password) {
    return {
      email: inMemoryCredentialsCache.admin_email.trim().toLowerCase(),
      password: inMemoryCredentialsCache.admin_password.trim(),
    };
  }
  return { email: 'admin@oracle.com', password: 'adminpassword123' };
}

export async function getSystemAdminCredentialsAsync(): Promise<{ email: string; password: string }> {
  const creds = await getSystemCredentials('system');
  if (creds?.admin_email && creds?.admin_password) {
    return {
      email: creds.admin_email.trim().toLowerCase(),
      password: creds.admin_password.trim(),
    };
  }
  return getSystemAdminCredentialsSync();
}


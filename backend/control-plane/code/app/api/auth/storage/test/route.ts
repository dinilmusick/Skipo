/**
 * POST /api/auth/storage/test
 *
 * Live Storage Connectivity Probe endpoint.
 * Tests connection to Backblaze B2, Cloudflare R2, AWS S3, or Supabase Storage
 * without saving credentials. Measures round-trip latency.
 */

import { NextResponse } from 'next/server';
import { testStorageConnection } from '@/lib/storage-providers';
import { UserStorageConnection } from '@/lib/types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-storage-test-post',
  method: 'POST',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024, executionTimeoutMs: 15000 },
  handler: async (_req, { session, body }) => {
    const connBody: UserStorageConnection = body;

    if (!connBody || !connBody.provider) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PAYLOAD: Storage connection configuration with provider is required.' },
        { status: 400 }
      );
    }

    let connToTest = connBody;
    const isMasked = (str?: string) => Boolean(str && str.includes('•'));
    if (
      connBody.id &&
      (isMasked(connBody.b2ApplicationKey) ||
        isMasked(connBody.r2SecretAccessKey) ||
        isMasked(connBody.s3SecretAccessKey) ||
        isMasked(connBody.supabaseAnonKey) ||
        isMasked(connBody.supabaseServiceKey))
    ) {
      const { findUserByIdAsync } = await import('@/lib/auth-storage');
      const user = await findUserByIdAsync(session!.userId);
      const existingConnections: UserStorageConnection[] =
        user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
      const found = existingConnections.find((c) => c.id === connBody.id);
      if (found) {
        connToTest = {
          ...found,
          ...connBody,
          b2ApplicationKey: isMasked(connBody.b2ApplicationKey) ? found.b2ApplicationKey : connBody.b2ApplicationKey,
          r2SecretAccessKey: isMasked(connBody.r2SecretAccessKey) ? found.r2SecretAccessKey : connBody.r2SecretAccessKey,
          s3SecretAccessKey: isMasked(connBody.s3SecretAccessKey) ? found.s3SecretAccessKey : connBody.s3SecretAccessKey,
          supabaseAnonKey: isMasked(connBody.supabaseAnonKey) ? found.supabaseAnonKey : connBody.supabaseAnonKey,
          supabaseServiceKey: isMasked(connBody.supabaseServiceKey) ? found.supabaseServiceKey : connBody.supabaseServiceKey,
        };
      }
    }

    const testResult = await testStorageConnection(connToTest);

    return NextResponse.json({
      success: testResult.ok,
      latencyMs: testResult.latencyMs,
      error: testResult.error,
      details: testResult.details,
    });
  },
});


/**
 * POST /api/auth/storage/test
 *
 * Live Storage Connectivity Probe endpoint.
 * Tests connection to Backblaze B2, Cloudflare R2, AWS S3, or Supabase Storage
 * without saving credentials. Measures round-trip latency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-storage';
import { testStorageConnection } from '@/lib/storage-providers';
import { UserStorageConnection } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body: UserStorageConnection = await req.json();

    if (!body || !body.provider) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PAYLOAD: Storage connection configuration with provider is required.' },
        { status: 400 }
      );
    }

    let connToTest = body;
    const isMasked = (str?: string) => Boolean(str && str.includes('•'));
    if (
      body.id &&
      (isMasked(body.b2ApplicationKey) ||
        isMasked(body.r2SecretAccessKey) ||
        isMasked(body.s3SecretAccessKey) ||
        isMasked(body.supabaseAnonKey) ||
        isMasked(body.supabaseServiceKey))
    ) {
      const { findUserByIdAsync } = await import('@/lib/auth-storage');
      const user = await findUserByIdAsync(session.userId);
      const existingConnections: UserStorageConnection[] =
        user?.appProfiles?.docustack?.storage_connections || (user as any)?.storage_connections || [];
      const found = existingConnections.find((c) => c.id === body.id);
      if (found) {
        connToTest = {
          ...found,
          ...body,
          b2ApplicationKey: isMasked(body.b2ApplicationKey) ? found.b2ApplicationKey : body.b2ApplicationKey,
          r2SecretAccessKey: isMasked(body.r2SecretAccessKey) ? found.r2SecretAccessKey : body.r2SecretAccessKey,
          s3SecretAccessKey: isMasked(body.s3SecretAccessKey) ? found.s3SecretAccessKey : body.s3SecretAccessKey,
          supabaseAnonKey: isMasked(body.supabaseAnonKey) ? found.supabaseAnonKey : body.supabaseAnonKey,
          supabaseServiceKey: isMasked(body.supabaseServiceKey) ? found.supabaseServiceKey : body.supabaseServiceKey,
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
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Storage connectivity probe failed' },
      { status: 500 }
    );
  }
}

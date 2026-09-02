/**
 * /api/auth/storage/connections
 *
 * User-Scoped Storage Connections Management.
 * Manages user's saved storage credentials (Backblaze B2, Cloudflare R2, AWS S3, Supabase, Local)
 * in their user profile inside the system database cluster.
 *
 * GET: List all saved connections for authenticated user (secrets masked)
 * POST: Create or update a storage connection
 * DELETE: Remove a connection by connectionId
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync, updateUserProfileAsync } from '@/lib/auth-storage';
import { maskStorageConnection, testStorageConnection } from '@/lib/storage-providers';
import { UserStorageConnection } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const connections: UserStorageConnection[] = user.appProfiles?.docustack?.storage_connections || [];
    const masked = connections.map(maskStorageConnection);

    return NextResponse.json({
      success: true,
      connections: masked,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to list connections' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body: UserStorageConnection = await req.json();
    if (!body || !body.provider) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PROVIDER: provider is required.' },
        { status: 400 }
      );
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const existingConnections: UserStorageConnection[] = user.appProfiles?.docustack?.storage_connections || [];
    const connectionId = body.id || `conn_${body.provider}_${Date.now()}`;
    const targetIdx = existingConnections.findIndex((c) => c.id === connectionId);
    const existing = targetIdx >= 0 ? existingConnections[targetIdx] : undefined;

    const isMaskedOrEmpty = (str?: string) => !str || str.includes('•');
    const hydratedBody: UserStorageConnection = {
      ...body,
      id: connectionId,
      b2ApplicationKey: isMaskedOrEmpty(body.b2ApplicationKey) && existing ? existing.b2ApplicationKey : body.b2ApplicationKey,
      r2SecretAccessKey: isMaskedOrEmpty(body.r2SecretAccessKey) && existing ? existing.r2SecretAccessKey : body.r2SecretAccessKey,
      s3SecretAccessKey: isMaskedOrEmpty(body.s3SecretAccessKey) && existing ? existing.s3SecretAccessKey : body.s3SecretAccessKey,
      supabaseAnonKey: isMaskedOrEmpty(body.supabaseAnonKey) && existing ? existing.supabaseAnonKey : body.supabaseAnonKey,
      supabaseServiceKey: isMaskedOrEmpty(body.supabaseServiceKey) && existing ? existing.supabaseServiceKey : body.supabaseServiceKey,
    };

    // Run test probe before saving if cloud provider
    let testStatus: 'ok' | 'failed' = 'ok';
    let testError: string | undefined = undefined;
    let latencyMs: number | undefined = undefined;

    if (hydratedBody.provider !== 'local_fs') {
      const probe = await testStorageConnection(hydratedBody);
      testStatus = probe.ok ? 'ok' : 'failed';
      testError = probe.error;
      latencyMs = probe.latencyMs;
    }

    const newOrUpdatedConn: UserStorageConnection = {
      ...hydratedBody,
      label: body.label?.trim() || existing?.label || `${body.provider.toUpperCase()} Vault`,
      createdAt: body.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testedAt: new Date().toISOString(),
      testStatus,
      testError,
      latencyMs,
    };

    let updatedList: UserStorageConnection[];
    if (targetIdx >= 0) {
      updatedList = [...existingConnections];
      updatedList[targetIdx] = newOrUpdatedConn;
    } else {
      updatedList = [...existingConnections, newOrUpdatedConn];
    }

    const updatedAppProfiles = {
      ...(user.appProfiles || {}),
      docustack: {
        ...(user.appProfiles?.docustack || {}),
        storage_connections: updatedList,
      },
    };

    await updateUserProfileAsync(session.userId, {
      appProfiles: updatedAppProfiles,
    } as any);

    return NextResponse.json({
      success: true,
      connection: maskStorageConnection(newOrUpdatedConn),
      testResult: { ok: testStatus === 'ok', latencyMs, error: testError },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const url = new URL(req.url);
    const connectionId = url.searchParams.get('id');

    if (!connectionId) {
      return NextResponse.json({ success: false, error: 'MISSING_CONNECTION_ID' }, { status: 400 });
    }

    const user = await findUserByIdAsync(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const existingConnections: UserStorageConnection[] = user.appProfiles?.docustack?.storage_connections || [];
    const updatedList = existingConnections.filter((c) => c.id !== connectionId);

    const updatedAppProfiles = {
      ...(user.appProfiles || {}),
      docustack: {
        ...(user.appProfiles?.docustack || {}),
        storage_connections: updatedList,
      },
    };

    await updateUserProfileAsync(session.userId, {
      appProfiles: updatedAppProfiles,
    } as any);

    return NextResponse.json({
      success: true,
      message: 'CONNECTION_REMOVED',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete connection' }, { status: 500 });
  }
}

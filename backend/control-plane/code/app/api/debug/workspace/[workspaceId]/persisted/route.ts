import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/persisted
 * Tier 3: Inspects persisted workspace state read directly from physical disk.
 * Bypasses in-memory cache to guarantee physical storage auditability.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { workspaceId } = await params;
  const snapshot = await debugManager.getPersistedSnapshot(workspaceId);

  return NextResponse.json({
    success: true,
    layer: 'PERSISTED',
    workspaceId,
    storageProvider: snapshot.storageProvider,
    filePath: snapshot.filePath,
    existsOnDisk: snapshot.existsOnDisk,
    rawPayloadSize: snapshot.rawPayloadSize,
    data: snapshot,
    timestamp: Date.now(),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/backend
 * Tier 2: Inspects authoritative backend memory state snapshot.
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
  const snapshot = await debugManager.getBackendSnapshot(workspaceId);

  return NextResponse.json({
    success: true,
    layer: 'BACKEND',
    workspaceId,
    data: snapshot,
    timestamp: Date.now(),
  });
}

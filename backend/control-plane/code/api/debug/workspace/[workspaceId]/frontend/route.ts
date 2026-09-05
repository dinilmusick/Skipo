import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/frontend
 * Tier 1: Inspects in-memory React client state snapshot reported by browser client.
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
  const snapshot = debugManager.getFrontendSnapshot(workspaceId);

  return NextResponse.json({
    success: true,
    layer: 'FRONTEND',
    workspaceId,
    clientConnected: snapshot.clientConnected,
    lastSeenAgoMs: snapshot.lastSeenAgoMs,
    data: snapshot,
    timestamp: Date.now(),
  });
}

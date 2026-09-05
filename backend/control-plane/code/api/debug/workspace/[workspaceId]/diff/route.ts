import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/diff
 * Computes field-level difference between any two state layers.
 * Query Params:
 *  - source: 'frontend' | 'backend' | 'persisted' | 'rendered' (default 'frontend')
 *  - target: 'frontend' | 'backend' | 'persisted' | 'rendered' (default 'backend')
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
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') || 'frontend';
  const target = searchParams.get('target') || 'backend';

  const diff = await debugManager.computeStateDiff(workspaceId, source, target);

  return NextResponse.json({
    success: true,
    diff,
    timestamp: Date.now(),
  });
}

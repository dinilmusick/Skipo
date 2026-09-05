import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/workspace/:workspaceId/check
 * Validates cross-tier consistency across Persisted, Backend, Frontend, and Rendered layers.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { workspaceId } = await params;
  const result = await debugManager.runConsistencyCheck(workspaceId);

  return NextResponse.json({
    success: true,
    workspaceId,
    consistent: result.consistent,
    layerComparisons: result.layerComparisons,
    discrepanciesCount: result.discrepancies.length,
    discrepancies: result.discrepancies,
    revisions: result.revisions,
    summary: result.summary,
    timestamp: Date.now(),
  });
}

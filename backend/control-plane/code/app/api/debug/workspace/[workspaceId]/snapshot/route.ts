import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/snapshot
 * Aggregates all 4 tiers (Frontend, Backend, Persisted, Rendered) + Revisions + Consistency check.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-snapshot-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  limits: { executionTimeoutMs: 15000 },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
    const snapshot = await debugManager.getCompleteWorkspaceSnapshot(workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId,
      snapshot,
      timestamp: Date.now(),
    });
  },
});

import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/diff
 * Computes field-level difference between any two state layers.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-diff-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params, query }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
    const source = query.get('source') || 'frontend';
    const target = query.get('target') || 'backend';

    const diff = await debugManager.computeStateDiff(workspaceId, source, target);

    return NextResponse.json({
      success: true,
      diff,
      timestamp: Date.now(),
    });
  },
});

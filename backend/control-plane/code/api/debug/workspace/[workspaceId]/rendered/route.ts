import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/rendered
 * Tier 4: Inspects actual rendered DOM elements from client canvas.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-rendered-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
    const snapshot = debugManager.getRenderedSnapshot(workspaceId);

    return NextResponse.json({
      success: true,
      layer: 'RENDERED',
      workspaceId,
      nodeCount: snapshot.nodeCount,
      edgeCount: snapshot.edgeCount,
      groupCount: snapshot.groupCount,
      data: snapshot,
      timestamp: Date.now(),
    });
  },
});

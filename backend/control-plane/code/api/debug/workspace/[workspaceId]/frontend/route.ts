import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/frontend
 * Tier 1: Inspects in-memory React client state snapshot reported by browser client.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-frontend-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
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
  },
});

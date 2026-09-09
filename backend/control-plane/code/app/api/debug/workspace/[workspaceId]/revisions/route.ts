import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/revisions
 * Returns monotonically increasing revision numbers across Frontend, Backend, and Persisted tiers.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-revisions-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
    const revisions = debugManager.updateRevision(workspaceId, {});

    return NextResponse.json({
      success: true,
      revisions,
      timestamp: Date.now(),
    });
  },
});

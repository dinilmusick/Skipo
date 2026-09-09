import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/persistence
 * Returns recorded persistence operations.
 * Query Params: workspaceId, type, limit
 */
export const GET = createSecureRoute({
  id: 'api-debug-persistence-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { query }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = query.get('workspaceId') || undefined;
    const type = query.get('type') || undefined;
    const limit = parseInt(query.get('limit') || '100', 10);

    const events = debugManager.getPersistenceEvents({ workspaceId, type, limit });

    return NextResponse.json({
      success: true,
      count: events.length,
      persistenceEvents: events,
      timestamp: Date.now(),
    });
  },
});

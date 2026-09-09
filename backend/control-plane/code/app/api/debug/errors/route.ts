import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/errors
 * Returns captured runtime errors across Frontend, Backend, Persistence, and Renderer layers.
 */
export const GET = createSecureRoute({
  id: 'api-debug-errors-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { query }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = query.get('workspaceId') || undefined;
    const layer = query.get('layer') || undefined;
    const limit = parseInt(query.get('limit') || '100', 10);

    const errors = debugManager.getErrors({ workspaceId, layer, limit });

    return NextResponse.json({
      success: true,
      count: errors.length,
      errors,
      timestamp: Date.now(),
    });
  },
});

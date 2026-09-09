import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/status
 * Returns complete debug capability manifest, active mode, and session metadata.
 */
export const GET = createSecureRoute({
  id: 'api-debug-status-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const status = debugManager.getStatus();
    return NextResponse.json({
      success: true,
      manifest: status,
      timestamp: Date.now(),
    });
  },
});

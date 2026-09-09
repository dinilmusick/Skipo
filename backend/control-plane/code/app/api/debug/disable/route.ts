import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/disable
 * Disables active debugging, setting mode to OFF.
 */
export const POST = createSecureRoute({
  id: 'api-debug-disable-post',
  method: 'POST',
  public: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const res = debugManager.disableSession();
    return NextResponse.json({
      success: res.success,
      message: res.message,
      mode: 'OFF',
      previousSession: res.previousSession,
      timestamp: Date.now(),
    });
  },
});

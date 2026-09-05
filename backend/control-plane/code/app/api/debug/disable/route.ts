import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/disable
 * Disables active debugging, setting mode to OFF.
 */
export async function POST(req: NextRequest) {
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
}

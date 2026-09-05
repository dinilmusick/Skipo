import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/sessions
 * Lists active and recent debug sessions.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const sessions = debugManager.getSessions();
  return NextResponse.json({
    success: true,
    activeSession: sessions.active,
    history: sessions.history,
    timestamp: Date.now(),
  });
}

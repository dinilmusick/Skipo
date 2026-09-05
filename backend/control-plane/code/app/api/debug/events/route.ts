import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/events
 * Queries raw event log from the bounded circular ring buffer.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const type = searchParams.get('type') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const sinceParam = searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam, 10) : undefined;

  const events = debugManager.getEvents({ workspaceId, type, limit, since });

  return NextResponse.json({
    success: true,
    count: events.length,
    events,
    timestamp: Date.now(),
  });
}

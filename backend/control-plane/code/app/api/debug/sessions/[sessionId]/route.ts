import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/sessions/:sessionId
 * Retrieves specific session metadata.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { sessionId } = await params;
  const session = debugManager.getSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ success: false, error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ success: true, session, timestamp: Date.now() });
}

/**
 * DELETE /api/debug/sessions/:sessionId
 * Terminates or removes a specific debug session.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { sessionId } = await params;
  const deleted = debugManager.deleteSession(sessionId);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: 'SESSION_TERMINATED',
    sessionId,
    timestamp: Date.now(),
  });
}

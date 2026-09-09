import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/sessions/:sessionId
 * Retrieves specific session metadata.
 */
export const GET = createSecureRoute({
  id: 'api-debug-sessions-id-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const sessionId = params.sessionId;
    const session = debugManager.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session, timestamp: Date.now() });
  },
});

/**
 * DELETE /api/debug/sessions/:sessionId
 * Terminates or removes a specific debug session.
 */
export const DELETE = createSecureRoute({
  id: 'api-debug-sessions-id-delete',
  method: 'DELETE',
  public: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const sessionId = params.sessionId;
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
  },
});

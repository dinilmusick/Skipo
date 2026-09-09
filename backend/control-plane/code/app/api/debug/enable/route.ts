import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/enable
 * Activates a debug session with specified mode (OBSERVE | TRACE) and bounded TTL.
 */
export const POST = createSecureRoute({
  id: 'api-debug-enable-post',
  method: 'POST',
  public: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { body }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const payload = body || {};
    const mode = payload.mode === 'TRACE' ? 'TRACE' : 'OBSERVE';
    const ttlMinutes = typeof payload.ttlMinutes === 'number' ? payload.ttlMinutes : 30;
    const workspaceId = payload.workspaceId;
    const capturePayloads = payload.capturePayloads;
    const maskDocumentText = payload.maskDocumentText;

    const session = debugManager.enableSession({
      mode,
      ttlMinutes,
      workspaceId,
      capturePayloads,
      maskDocumentText,
      actor: payload.actor || 'ai-agent',
    });

    return NextResponse.json({
      success: true,
      message: 'DEBUG_SESSION_ENABLED',
      session,
      timestamp: Date.now(),
    });
  },
});

import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/enable
 * Activates a debug session with specified mode (OBSERVE | TRACE) and bounded TTL.
 */
export async function POST(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'TRACE' ? 'TRACE' : 'OBSERVE';
    const ttlMinutes = typeof body.ttlMinutes === 'number' ? body.ttlMinutes : 30;
    const workspaceId = body.workspaceId;
    const capturePayloads = body.capturePayloads;
    const maskDocumentText = body.maskDocumentText;

    const session = debugManager.enableSession({
      mode,
      ttlMinutes,
      workspaceId,
      capturePayloads,
      maskDocumentText,
      actor: body.actor || 'ai-agent',
    });

    return NextResponse.json({
      success: true,
      message: 'DEBUG_SESSION_ENABLED',
      session,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'FAILED_TO_ENABLE_DEBUG', message: err?.message },
      { status: 500 }
    );
  }
}

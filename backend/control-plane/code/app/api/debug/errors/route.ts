import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/errors
 * Returns captured runtime errors across Frontend, Backend, Persistence, and Renderer layers.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const layer = searchParams.get('layer') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  const errors = debugManager.getErrors({ workspaceId, layer, limit });

  return NextResponse.json({
    success: true,
    count: errors.length,
    errors,
    timestamp: Date.now(),
  });
}

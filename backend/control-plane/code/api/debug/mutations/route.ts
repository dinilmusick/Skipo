import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/mutations
 * Returns recorded workspace mutations.
 * Query Params: workspaceId, type, limit (default 100)
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

  const mutations = debugManager.getMutations({ workspaceId, type, limit });

  return NextResponse.json({
    success: true,
    count: mutations.length,
    mutations,
    timestamp: Date.now(),
  });
}

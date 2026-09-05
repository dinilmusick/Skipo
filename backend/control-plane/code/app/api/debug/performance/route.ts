import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/performance
 * Returns latency metrics, benchmarks, and performance samples.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const metric = searchParams.get('metric') || undefined;

  const perf = debugManager.getPerformance({ workspaceId, metric });

  return NextResponse.json({
    success: true,
    samplesCount: perf.samples.length,
    averages: perf.averages,
    samples: perf.samples,
    timestamp: Date.now(),
  });
}

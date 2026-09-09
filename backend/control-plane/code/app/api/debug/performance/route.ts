import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/performance
 * Returns latency metrics, benchmarks, and performance samples.
 */
export const GET = createSecureRoute({
  id: 'api-debug-performance-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { query }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = query.get('workspaceId') || undefined;
    const metric = query.get('metric') || undefined;

    const perf = debugManager.getPerformance({ workspaceId, metric });

    return NextResponse.json({
      success: true,
      samplesCount: perf.samples.length,
      averages: perf.averages,
      samples: perf.samples,
      timestamp: Date.now(),
    });
  },
});

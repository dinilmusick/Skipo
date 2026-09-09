import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/export
 * Compiles and returns comprehensive diagnostic export bundle for AI agent diagnostics.
 */
export const POST = createSecureRoute({
  id: 'api-debug-export-post',
  method: 'POST',
  public: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024, executionTimeoutMs: 15000 },
  handler: async (req, { body }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const payload = body || {};
    const workspaceId = payload.workspaceId || 'default';

    const bundle = await debugManager.exportDiagnostics(workspaceId);

    return NextResponse.json({
      success: true,
      diagnosticBundle: bundle,
      timestamp: Date.now(),
    });
  },
});

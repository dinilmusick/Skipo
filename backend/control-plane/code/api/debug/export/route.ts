import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/debug/export
 * Compiles and returns comprehensive diagnostic export bundle for AI agent diagnostics.
 */
export async function POST(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || 'default';

    const bundle = await debugManager.exportDiagnostics(workspaceId);

    return NextResponse.json({
      success: true,
      diagnosticBundle: bundle,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'DIAGNOSTIC_EXPORT_FAILED', message: err?.message },
      { status: 500 }
    );
  }
}

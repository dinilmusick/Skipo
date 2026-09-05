import { NextRequest, NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/config
 * Retrieves configuration parameters.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const config = debugManager.getConfig();
  return NextResponse.json({ success: true, config, timestamp: Date.now() });
}

/**
 * PUT /api/debug/config
 * Updates configuration parameters.
 */
export async function PUT(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = debugManager.updateConfig(body);
    return NextResponse.json({
      success: true,
      message: 'CONFIG_UPDATED',
      config: updated,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'FAILED_TO_UPDATE_CONFIG', message: err?.message },
      { status: 500 }
    );
  }
}

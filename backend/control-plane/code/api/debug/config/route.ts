import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/config
 * Retrieves configuration parameters.
 */
export const GET = createSecureRoute({
  id: 'api-debug-config-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const config = debugManager.getConfig();
    return NextResponse.json({ success: true, config, timestamp: Date.now() });
  },
});

/**
 * PUT /api/debug/config
 * Updates configuration parameters.
 */
export const PUT = createSecureRoute({
  id: 'api-debug-config-put',
  method: 'PUT',
  public: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { body }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const updated = debugManager.updateConfig(body || {});
    return NextResponse.json({
      success: true,
      message: 'CONFIG_UPDATED',
      config: updated,
      timestamp: Date.now(),
    });
  },
});

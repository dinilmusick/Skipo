import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/workspace/:workspaceId/persisted
 * Tier 3: Inspects persisted workspace state read directly from physical disk.
 */
export const GET = createSecureRoute({
  id: 'api-debug-workspace-persisted-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req, { params }) => {
    const auth = authorizeDebugRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const workspaceId = params.workspaceId;
    const snapshot = await debugManager.getPersistedSnapshot(workspaceId);

    return NextResponse.json({
      success: true,
      layer: 'PERSISTED',
      workspaceId,
      storageProvider: snapshot.storageProvider,
      filePath: snapshot.filePath,
      existsOnDisk: snapshot.existsOnDisk,
      rawPayloadSize: snapshot.rawPayloadSize,
      data: snapshot,
      timestamp: Date.now(),
    });
  },
});

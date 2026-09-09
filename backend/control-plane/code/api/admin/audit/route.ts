import { NextResponse } from 'next/server';
import { enforceAdminGuard } from '@/lib/control-plane';
import { getAdminAuditLogs } from '@/lib/audit-logger';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-admin-audit-get',
  method: 'GET',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const logs = getAdminAuditLogs(100);
    return NextResponse.json({
      success: true,
      logs,
      total: logs.length,
    });
  },
});

import { NextRequest, NextResponse } from 'next/server';
import { enforceAdminGuard } from '@/lib/control-plane';
import { getAdminAuditLogs } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
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
}

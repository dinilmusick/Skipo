import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const status = debugManager.getStatus();
  const sessions = debugManager.getSessions();

  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.round(process.uptime()),
    debug: {
      enabled: status.debugEnabled,
      mode: status.activeMode,
      activeSessionsCount: sessions.active ? 1 : 0,
      activeSessionId: sessions.active?.id || null,
      eventsBuffered: status.systemMetrics.eventsBuffered,
      memoryUsageMb: status.systemMetrics.memoryUsageMb,
    },
  });
}

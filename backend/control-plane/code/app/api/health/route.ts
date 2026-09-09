import { NextResponse } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-health-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async () => {
    const status = debugManager.getStatus();
    const sessions = debugManager.getSessions();

    return NextResponse.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.round(process.uptime ? process.uptime() : 0),
      debug: {
        enabled: status.debugEnabled,
        mode: status.activeMode,
        activeSessionsCount: sessions.active ? 1 : 0,
        activeSessionId: sessions.active?.id || null,
        eventsBuffered: status.systemMetrics.eventsBuffered,
        memoryUsageMb: status.systemMetrics.memoryUsageMb,
      },
    });
  },
});

import { NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-telemetry-get',
  method: 'GET',
  public: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async () => {
    return NextResponse.json({
      status: 'ONLINE',
      runtime: 'EDGE_NODE',
      uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 3600),
      timestamp: Date.now(),
    });
  },
});

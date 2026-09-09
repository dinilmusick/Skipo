import { NextResponse } from 'next/server';
import {
  subscribeRealtimeEvents,
  getRecentEvents,
  RealtimeWorkspaceEvent,
} from '@/lib/realtime-events';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-events-get',
  method: 'GET',
  auth: { required: true },
  rateLimit: {
    tier: 'CHEAP_READ',
    requests: 300, // accommodate fast polling and reconnects
    windowMs: 60 * 1000,
  },
  limits: {
    maxExecutionMs: 60000, // Allow 60s SSE connection window
  },
  handler: async (req, { session, query }) => {
    const streamParam = query.get('stream');
    const acceptHeader = req.headers.get('accept') || '';
    const isSSE = streamParam === 'true' || acceptHeader.includes('text/event-stream');

    const requestedWsId = req.headers.get('x-workspace-id') || query.get('workspaceId') || undefined;
    const currentUserId = session?.userId;

    // 1. Polling fallback mode
    if (!isSSE) {
      const sinceRaw = query.get('since');
      const sinceTs = sinceRaw ? parseInt(sinceRaw, 10) : 0;
      const events = getRecentEvents(sinceTs, requestedWsId, currentUserId);
      return NextResponse.json({
        success: true,
        events,
        timestamp: Date.now(),
      });
    }

    // 2. Server-Sent Events (SSE) streaming mode
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection packet
        const initPayload = JSON.stringify({
          type: 'CONNECTED',
          timestamp: Date.now(),
          workspaceId: requestedWsId,
        });
        controller.enqueue(encoder.encode(`event: connected\ndata: ${initPayload}\n\n`));

        // Subscribe to real-time event bus
        const unsubscribe = subscribeRealtimeEvents((event: RealtimeWorkspaceEvent) => {
          if (requestedWsId && event.workspaceId && event.workspaceId !== requestedWsId) {
            return;
          }

          try {
            const chunk = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Stream closed
          }
        });

        // Send 30-second heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          unsubscribe();
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  },
});

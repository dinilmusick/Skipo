import { NextRequest, NextResponse } from 'next/server';
import {
  subscribeRealtimeEvents,
  getRecentEvents,
  RealtimeWorkspaceEvent,
} from '@/lib/realtime-events';
import { verifySessionToken } from '@/lib/auth-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamParam = searchParams.get('stream');
  const acceptHeader = req.headers.get('accept') || '';
  const isSSE = streamParam === 'true' || acceptHeader.includes('text/event-stream');

  // Optional workspace and user filters
  const requestedWsId = req.headers.get('x-workspace-id') || searchParams.get('workspaceId') || undefined;
  
  // Try extracting user from session if available
  const authHeader = req.headers.get('authorization') || '';
  const token = req.cookies.get('docustack_session')?.value || authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = token ? verifySessionToken(token) : null;
  const currentUserId = session?.userId;

  // 1. Polling fallback mode
  if (!isSSE) {
    const sinceRaw = searchParams.get('since');
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
        // Workspace isolation filter if workspaceId was provided
        if (requestedWsId && event.workspaceId && event.workspaceId !== requestedWsId) {
          return;
        }

        try {
          const chunk = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream might be closed
        }
      });

      // Send 15-second heartbeat to keep connection alive on Vercel/proxies
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // Clean up when client disconnects
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
}

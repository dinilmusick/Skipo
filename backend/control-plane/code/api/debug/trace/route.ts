import { NextRequest } from 'next/server';
import { debugManager } from '@/lib/debug-manager';
import { authorizeDebugRequest } from '@/lib/debug-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/debug/trace
 * Live Server-Sent Events (SSE) stream for real-time debug and trace events.
 * Only emits continuous event streaming when active mode is TRACE.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeDebugRequest(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mode = debugManager.getMode();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection handshake
      const initialPayload = JSON.stringify({
        type: 'CONNECTED',
        mode,
        isTraceMode: mode === 'TRACE',
        timestamp: Date.now(),
        message: mode === 'TRACE' ? 'TRACE_STREAM_ACTIVE' : 'TRACE_STREAM_STANDBY: Enable TRACE mode to stream real-time events.',
      });
      controller.enqueue(encoder.encode(`event: handshake\ndata: ${initialPayload}\n\n`));

      // Subscribe to live trace events
      const unsubscribe = debugManager.subscribeTrace((event) => {
        try {
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${payload}\n\n`));
        } catch {
          // Stream error ignored
        }
      });

      // Keepalive heartbeat every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

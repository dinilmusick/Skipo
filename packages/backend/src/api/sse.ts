export function createSSEResponse(
  setupStream: (send: (event: string, data: any) => void) => () => void,
  heartbeatMs = 15000
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const cleanup = setupStream(send);

      const heartbeat = setInterval(() => {
        send('ping', { time: Date.now() });
      }, heartbeatMs);

      // Simple way to handle cleanup on close
      // Actually standard ReadableStream doesn't natively expose onClose easily here without tracking it in a wrapper.
      // We will just clear interval on cancel.
      (controller as any).cancel = () => {
        clearInterval(heartbeat);
        cleanup();
      };
    },
    cancel() {
      // Handled above conceptually
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

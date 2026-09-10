// src/api/BaseApiRoute.ts
import { SkipoBase } from "@skipo/core";
var BaseApiRoute = class extends SkipoBase {
  config;
  constructor(config = {}) {
    super({ name: "BaseApiRoute" });
    this.config = config;
  }
  success(data, status = 200) {
    return new Response(JSON.stringify({ data, status }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
  error(message, status = 400) {
    return new Response(JSON.stringify({ error: message, status }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// src/api/middleware.ts
function withAuth(verifyToken) {
  return async (req) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", status: 401 }), { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const isValid = await verifyToken(token);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Unauthorized", status: 401 }), { status: 401 });
    }
    return null;
  };
}
function withCors(allowedOrigin = "*") {
  return async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    return null;
  };
}

// src/api/sse.ts
function getSSEHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive"
  };
}
function createSSEResponse(setupStream, heartbeatMs = 15e3) {
  let timer = null;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event, data) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}
data: ${JSON.stringify(data)}

`));
      };
      const cleanup = setupStream(send);
      const ping = () => {
        timer = setTimeout(() => {
          send("ping", { time: Date.now() });
          ping();
        }, heartbeatMs);
      };
      ping();
      controller.cancel = () => {
        if (timer) clearTimeout(timer);
        cleanup();
      };
    }
  });
  return new Response(stream, { headers: getSSEHeaders() });
}

export {
  BaseApiRoute,
  withAuth,
  withCors,
  createSSEResponse
};

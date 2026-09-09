/**
 * @fileoverview API Governance Observability & Error Handler Template
 */

export const governanceObservabilityTemplate = () => `export interface TelemetryRecord {
  requestId: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  clientIp: string;
  timestamp: string;
}

class ObservabilityRingBuffer {
  private buffer: TelemetryRecord[] = [];
  private readonly maxCapacity = 500;

  public record(entry: TelemetryRecord): void {
    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  public getRecent(count = 50): TelemetryRecord[] {
    return this.buffer.slice(-count);
  }
}

export const observabilityBuffer = new ObservabilityRingBuffer();
`;

export const governanceErrorHandlerTemplate = () => `import { NextResponse } from 'next/server';

export function handleSecureRouteError(err: any, requestId: string): NextResponse {
  console.error(\`[API Error] [Request: \${requestId}]:\`, err);
  const isTimeout = err?.message?.includes('timed out');
  const status = isTimeout ? 504 : 500;
  const message = isTimeout ? 'Request execution timed out' : 'Internal Server Error';

  return NextResponse.json(
    {
      error: message,
      incidentId: requestId,
      status
    },
    { status }
  );
}
`;

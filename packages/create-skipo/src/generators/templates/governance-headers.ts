/**
 * @fileoverview API Governance Security Headers Template
 */

export const governanceHeadersTemplate = () => `import { NextResponse } from 'next/server';

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' *;"
};

export function applySecurityHeaders(res: NextResponse | Response, requestId: string): void {
  for (const [header, val] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(header)) {
      res.headers.set(header, val);
    }
  }
  res.headers.set('X-Request-Id', requestId);
}
`;

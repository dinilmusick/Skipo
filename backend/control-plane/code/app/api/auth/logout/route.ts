import { NextResponse } from 'next/server';
import { verifySessionToken, revokeSession } from '@/lib/auth-storage';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-logout',
  method: 'POST',
  public: true,
  rateLimit: { tier: 'AUTHENTICATION' },
  handler: async (req) => {
    const cookieToken = req.cookies.get('docustack_session')?.value;
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

    const token = cookieToken || headerToken;
    if (token) {
      const session = verifySessionToken(token);
      if (session) {
        revokeSession(session.sessionId);
      }
    }

    const response = NextResponse.json({ success: true, message: 'LOGGED_OUT' });
    response.cookies.delete('docustack_session');
    return response;
  },
});


import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-storage';
import {
  createSecureRoute,
  revokeSession,
  revokeAllUserSessions,
} from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-logout',
  method: 'POST',
  public: true,
  rateLimit: { tier: 'AUTHENTICATION' },
  handler: async (req, { session, query, body }) => {
    const allDevicesParam =
      query instanceof URLSearchParams ? query.get('allDevices') : (query as any)?.allDevices;
    const allDevices = allDevicesParam === 'true' || body?.allDevices === true;

    if (session?.sessionId) {
      if (allDevices && session.userId) {
        revokeAllUserSessions(session.userId, 'USER_LOGOUT_ALL_DEVICES');
      } else {
        revokeSession(session.sessionId, 'USER_LOGOUT');
      }
    }

    const response = NextResponse.json({
      success: true,
      message: allDevices ? 'LOGGED_OUT_ALL_DEVICES' : 'LOGGED_OUT',
    });

    return clearAuthCookies(response);
  },
});


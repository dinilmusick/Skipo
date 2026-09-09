import { NextResponse } from 'next/server';
import { attachAuthCookies } from '@/lib/auth-storage';
import {
  createSecureRoute,
  rotateRefreshToken,
} from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-refresh',
  method: 'POST',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  limits: { maxBodySize: 16 * 1024 },
  handler: async (req, { body, ip, userAgent }) => {
    // 1. Extract raw refresh token from cookie or body
    const cookieToken = req.cookies.get('docustack_refresh_token')?.value;
    const bodyToken = body?.refreshToken;
    const rawRefreshToken = (cookieToken || bodyToken || '').trim();

    if (!rawRefreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REFRESH_TOKEN',
          message: 'A valid refresh token is required in cookie or body.',
        },
        { status: 401 }
      );
    }

    try {
      // 2. Rotate refresh token atomically (and detect theft/reuse)
      const rotated = rotateRefreshToken(rawRefreshToken, { ip, userAgent });

      const response = NextResponse.json({
        success: true,
        message: 'TOKEN_ROTATED_SUCCESSFULLY',
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        sessionId: rotated.sessionId,
      });

      // 3. Attach updated HttpOnly cookies
      return attachAuthCookies(response, {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
      });
    } catch (err: any) {
      const isTheft =
        err?.message?.includes('TOKEN_THEFT_DETECTED') ||
        err?.message?.includes('REFRESH_TOKEN_REUSE');

      const errorCode = isTheft ? 'TOKEN_THEFT_DETECTED' : 'INVALID_REFRESH_TOKEN';

      return NextResponse.json(
        {
          success: false,
          error: errorCode,
          message: err?.message || 'Invalid or expired refresh token.',
        },
        { status: 401 }
      );
    }
  },
});

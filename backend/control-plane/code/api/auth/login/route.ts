import { NextResponse } from 'next/server';
import { authenticateUserAsync, attachSessionCookie } from '@/lib/auth-storage';
import { logAdminEvent } from '@/lib/audit-logger';
import { createSecureRoute, resetGovernanceRateLimit } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-login',
  method: 'POST',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  limits: { maxBodySize: 32 * 1024 },
  handler: async (req, { body, ip }) => {
    const { email, password, isAdminLogin } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    try {
      const { user, token } = await authenticateUserAsync(email, password);

      // If request comes from admin login or role is admin check
      if (isAdminLogin && user.role !== 'admin') {
        logAdminEvent({
          actor_user_id: user.id,
          action: 'ADMIN_LOGIN_FAILED',
          ip_address: ip,
          details: 'Attempted admin login with non-admin role',
        });
        return NextResponse.json(
          { success: false, error: 'User does not have Administrator privileges.' },
          { status: 401 }
        );
      }

      // Reset login rate limit on successful authentication
      resetGovernanceRateLimit(`route:api-auth-login:ip:${ip}`);

      if (user.role === 'admin') {
        logAdminEvent({
          actor_user_id: user.id,
          action: 'ADMIN_LOGIN_SUCCESS',
          ip_address: ip,
          details: 'Admin authenticated successfully',
        });
      }

      const response = NextResponse.json({
        success: true,
        message: 'AUTHENTICATION_SUCCESSFUL',
        user,
        token,
      });

      return attachSessionCookie(response, token);
    } catch (err: any) {
      logAdminEvent({
        actor_user_id: 'anonymous',
        action: 'LOGIN_FAILURE',
        ip_address: ip,
        details: `Failed authentication attempt: ${err?.message || 'Unknown'}`,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            err?.message === 'INVALID_CREDENTIALS'
              ? 'Invalid credentials. Please verify your email and password.'
              : 'Invalid credentials.',
        },
        { status: 401 }
      );
    }
  },
});

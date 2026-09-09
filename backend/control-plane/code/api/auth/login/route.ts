import { NextResponse } from 'next/server';
import { authenticateUserAsync, attachAuthCookies, findUserByEmail } from '@/lib/auth-storage';
import { logAdminEvent } from '@/lib/audit-logger';
import {
  createSecureRoute,
  resetGovernanceRateLimit,
  createSession,
  recordAbuseSignal,
  recordSecurityEvent,
} from '@/lib/api-governance';

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
  handler: async (req, { body, ip, userAgent }) => {
    const { email, password, isAdminLogin, deviceId } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    try {
      const { user } = await authenticateUserAsync(email, password);

      // Check account status
      if (user.status && user.status !== 'ACTIVE') {
        recordSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          accountId: user.id,
          ip,
          metadata: { reason: `Attempted login to ${user.status} account` },
        });
        return NextResponse.json(
          { success: false, error: `Account is ${user.status.toLowerCase()}. Access denied.` },
          { status: 403 }
        );
      }

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

      // Create independent session with rotating refresh token
      const sessionResult = createSession(user.id, {
        deviceId,
        userAgent,
        ipAddress: ip,
      });

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
        token: sessionResult.accessToken,
        accessToken: sessionResult.accessToken,
        refreshToken: sessionResult.refreshToken,
        sessionId: sessionResult.session.id,
      });

      return attachAuthCookies(response, {
        accessToken: sessionResult.accessToken,
        refreshToken: sessionResult.refreshToken,
      });
    } catch (err: any) {
      // Record abuse signal if email exists
      const existingUser = findUserByEmail(email);
      if (existingUser) {
        recordAbuseSignal(existingUser.id, 'failedLogins', 1, ip);
      }

      recordSecurityEvent({
        type: 'LOGIN_FAILURE',
        accountId: existingUser?.id,
        ip,
        metadata: { email, error: err?.message },
      });

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

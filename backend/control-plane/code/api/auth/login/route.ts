import { NextRequest, NextResponse } from 'next/server';
import { authenticateUserAsync, attachSessionCookie } from '@/lib/auth-storage';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';
import { logAdminEvent } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // Rate limiting check: max 25 attempts per 15 minutes per IP
  const rateLimit = checkRateLimit(`login_${ip}`, 25, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, isAdminLogin } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

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

    // Reset rate limit on success
    resetRateLimit(`login_${ip}`);

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

    // Attach HttpOnly cookie
    return attachSessionCookie(response, token);
  } catch (err: any) {
    logAdminEvent({
      actor_user_id: 'anonymous',
      action: 'LOGIN_FAILURE',
      ip_address: ip,
      details: `Failed authentication attempt: ${err?.message || 'Unknown'}`,
    });
    return NextResponse.json(
      { success: false, error: err?.message === 'INVALID_CREDENTIALS' ? 'Invalid credentials. Please verify your email and password.' : 'Invalid credentials.' },
      { status: 401 }
    );
  }
}

import { NextResponse } from 'next/server';
import { registerUserAsync, isValidEmail, attachSessionCookie } from '@/lib/auth-storage';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-register',
  method: 'POST',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  limits: { maxBodySize: 32 * 1024 },
  handler: async (req, { body }) => {
    const { email, password, name, username } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS: Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_EMAIL: Please enter a valid email address (e.g. user@example.com).' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'PASSWORD_TOO_SHORT: Minimum 6 characters required.' },
        { status: 400 }
      );
    }

    const { user, token } = await registerUserAsync(cleanEmail, password, name, username);

    const response = NextResponse.json({
      success: true,
      message: 'USER_REGISTERED_SUCCESSFULLY',
      user,
      token,
    });

    return attachSessionCookie(response, token);
  },
});

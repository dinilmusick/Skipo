import { NextResponse } from 'next/server';
import { registerUserAsync, isValidEmail, attachAuthCookies } from '@/lib/auth-storage';
import {
  createSecureRoute,
  createSession,
  createEmailVerificationChallenge,
} from '@/lib/api-governance';

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
  handler: async (req, { body, ip, userAgent }) => {
    const { email, password, name, username, deviceId } = body || {};

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

    const { user } = await registerUserAsync(cleanEmail, password, name, username);

    // Create initial session
    const sessionResult = createSession(user.id, {
      deviceId,
      userAgent,
      ipAddress: ip,
    });

    // Create email verification challenge
    const challenge = createEmailVerificationChallenge(user.id, cleanEmail, ip);

    const response = NextResponse.json({
      success: true,
      message: 'USER_REGISTERED_SUCCESSFULLY',
      user,
      token: sessionResult.accessToken,
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.session.id,
      verificationToken: challenge.rawToken,
      verificationChallengeId: challenge.challenge.id,
    });

    return attachAuthCookies(response, {
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
    });
  },
});

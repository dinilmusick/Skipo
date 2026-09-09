import { NextResponse } from 'next/server';
import { findUserByEmail, findUserById } from '@/lib/auth-storage';
import {
  createSecureRoute,
  checkResendRateLimit,
  createEmailVerificationChallenge,
  recordAbuseSignal,
} from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-auth-resend-verification',
  method: 'POST',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  limits: { maxBodySize: 16 * 1024 },
  handler: async (req, { body, session, ip }) => {
    let email = (body?.email || '').trim().toLowerCase();
    let accountId = session?.userId;

    if (!email && accountId) {
      const user = findUserById(accountId);
      if (user?.email) email = user.email.toLowerCase();
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_EMAIL',
          message: 'An email address is required to resend verification.',
        },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (user) {
      accountId = user.id;
      if (user.emailVerified) {
        return NextResponse.json({
          success: true,
          message: 'EMAIL_ALREADY_VERIFIED',
          alreadyVerified: true,
        });
      }
    }

    // Check multi-tier resend rate limit (account, email, IP)
    const rateCheck = checkResendRateLimit(accountId, email, ip);
    if (!rateCheck.allowed) {
      if (accountId) {
        recordAbuseSignal(accountId, 'verificationResends', 1, ip);
      }
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many resend attempts. Please wait ${rateCheck.retryAfterSec}s before trying again.`,
          retryAfterSec: rateCheck.retryAfterSec,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSec) },
        }
      );
    }

    // Create new verification challenge
    const targetAccountId = accountId || `anon_${Date.now()}`;
    const challenge = createEmailVerificationChallenge(targetAccountId, email, ip);

    return NextResponse.json({
      success: true,
      message: 'VERIFICATION_EMAIL_SENT',
      verificationChallengeId: challenge.challenge.id,
      verificationToken: challenge.rawToken,
    });
  },
});

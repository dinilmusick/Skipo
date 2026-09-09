import { NextResponse } from 'next/server';
import {
  createSecureRoute,
  verifyEmailChallenge,
} from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleVerification(token: string | null | undefined, ip: string) {
  if (!token || typeof token !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Verification token is required.',
      },
      { status: 400 }
    );
  }

  const result = verifyEmailChallenge(token.trim(), ip);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'VERIFICATION_FAILED',
        message:
          result.error === 'CHALLENGE_EXPIRED'
            ? 'Verification challenge has expired. Please request a new one.'
            : result.error === 'MAX_ATTEMPTS_EXCEEDED'
            ? 'Maximum verification attempts exceeded. Please request a new challenge.'
            : 'Invalid or already-consumed verification token.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'EMAIL_VERIFIED_SUCCESSFULLY',
    trustLevel: result.trustLevel || 'T1_EMAIL_VERIFIED',
    accountId: result.accountId,
  });
}

export const GET = createSecureRoute({
  id: 'api-auth-verify-email-get',
  method: 'GET',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  handler: async (req, { query, ip }) => {
    const token =
      query instanceof URLSearchParams ? query.get('token') : (query as any)?.token;
    return handleVerification(token, ip);
  },
});

export const POST = createSecureRoute({
  id: 'api-auth-verify-email-post',
  method: 'POST',
  public: true,
  rateLimit: {
    tier: 'AUTHENTICATION',
    key: 'ip',
  },
  limits: { maxBodySize: 16 * 1024 },
  handler: async (req, { body, query, ip }) => {
    const queryToken =
      query instanceof URLSearchParams ? query.get('token') : (query as any)?.token;
    const token = body?.token || queryToken;
    return handleVerification(token, ip);
  },
});

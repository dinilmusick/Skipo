/**
 * @fileoverview Email Verification Challenge & Resend Rate Limiter Template
 */

export const governanceEmailVerificationTemplate = () => `import crypto from 'crypto';
import { generateRandomToken, hashToken } from './session-manager';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_VERIFICATION_ATTEMPTS = 5;

export interface EmailVerificationChallenge {
  id: string;
  accountId: string;
  email: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
  attemptCount: number;
  maxAttempts: number;
}

const challengesById = new Map<string, EmailVerificationChallenge>();
const challengesByHash = new Map<string, EmailVerificationChallenge>();
const resendRateLimitMap = new Map<string, number[]>();

export function checkResendRateLimit(
  accountId: string | undefined,
  email: string,
  ip: string
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  const checkBucket = (key: string, max: number) => {
    let bucket = resendRateLimitMap.get(key) || [];
    const valid = bucket.filter((ts) => now - ts < windowMs);
    resendRateLimitMap.set(key, valid);
    if (valid.length >= max) {
      const retryAfter = Math.ceil((valid[0] + windowMs - now) / 1000);
      return { allowed: false, retryAfterSec: Math.max(1, retryAfter) };
    }
    return { allowed: true };
  };

  if (accountId) {
    const r = checkBucket(\`resend:account:\${accountId}\`, 3);
    if (!r.allowed) return r;
  }
  const rEmail = checkBucket(\`resend:email:\${email.toLowerCase()}\`, 3);
  if (!rEmail.allowed) return rEmail;
  const rIp = checkBucket(\`resend:ip:\${ip}\`, 5);
  if (!rIp.allowed) return rIp;

  if (accountId) resendRateLimitMap.get(\`resend:account:\${accountId}\`)?.push(now);
  resendRateLimitMap.get(\`resend:email:\${email.toLowerCase()}\`)?.push(now);
  resendRateLimitMap.get(\`resend:ip:\${ip}\`)?.push(now);
  return { allowed: true };
}

export function createEmailVerificationChallenge(
  accountOrId: { id: string; email: string } | string,
  emailOrIp?: string,
  ipArg?: string
): { challenge: EmailVerificationChallenge; rawToken: string } {
  const accountId = typeof accountOrId === 'object' ? accountOrId.id : accountOrId;
  const email = typeof accountOrId === 'object' ? accountOrId.email : (emailOrIp || '');

  for (const c of challengesById.values()) {
    if (c.accountId === accountId && !c.consumedAt) {
      c.consumedAt = Date.now();
      challengesByHash.delete(c.tokenHash);
    }
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const now = Date.now();

  const challenge: EmailVerificationChallenge = {
    id: \`evc_\${now}_\${Math.random().toString(36).slice(2, 7)}\`,
    accountId,
    email: email.toLowerCase(),
    tokenHash,
    createdAt: now,
    expiresAt: now + VERIFICATION_TOKEN_TTL_MS,
    attemptCount: 0,
    maxAttempts: MAX_VERIFICATION_ATTEMPTS,
  };

  challengesById.set(challenge.id, challenge);
  challengesByHash.set(tokenHash, challenge);
  return { challenge, rawToken };
}

export function verifyEmailChallenge(rawToken: string): { success: boolean; error?: string; accountId?: string } {
  if (!rawToken) return { success: false, error: 'TOKEN_REQUIRED' };
  const tokenHash = hashToken(rawToken);
  const challenge = challengesByHash.get(tokenHash);
  if (!challenge) return { success: false, error: 'INVALID_TOKEN' };

  if (challenge.consumedAt) return { success: false, error: 'TOKEN_ALREADY_USED' };
  if (Date.now() > challenge.expiresAt) return { success: false, error: 'CHALLENGE_EXPIRED' };
  if (challenge.attemptCount >= challenge.maxAttempts) return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED' };

  challenge.consumedAt = Date.now();
  challengesByHash.delete(tokenHash);
  return { success: true, accountId: challenge.accountId };
}
`;

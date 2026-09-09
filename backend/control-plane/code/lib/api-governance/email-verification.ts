// ══════════════════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION LIFECYCLE & CHALLENGE ENGINE
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Sections 4, 5, 6 of the Progressive Trust Specification:
// Cryptographic challenge generation, token hashing, expiration, attempt counting,
// challenge consumption, and multi-tier resend rate limiting.

import fs from 'fs';
import path from 'path';
import { EmailVerificationChallenge, TrustLevel } from './types';
import { getControlPlaneDir, findUserById, saveUsers, loadUsers } from '../auth-storage';
import { generateRandomToken, hashToken } from './session-manager';
import { recordSecurityEvent } from './security-events';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory challenge storage for high speed with disk persistence
const challengesByHash = new Map<string, EmailVerificationChallenge>();
const challengesById = new Map<string, EmailVerificationChallenge>();

// In-memory resend rate limiting buckets: key -> timestamp[]
const resendRateLimitMap = new Map<string, number[]>();

function getChallengesFilePath(): string {
  const dir = getControlPlaneDir();
  return path.join(dir, 'verification_challenges.json');
}

function hydrateChallengesFromDisk(): void {
  try {
    const filePath = getChallengesFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const list: EmailVerificationChallenge[] = JSON.parse(raw);
      for (const c of list) {
        challengesById.set(c.id, c);
        if (!c.consumedAt) {
          challengesByHash.set(c.tokenHash, c);
        }
      }
    }
  } catch {}
}

function persistChallengesToDisk(): void {
  try {
    const filePath = getChallengesFilePath();
    const list = Array.from(challengesById.values());
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

/**
 * Multi-tier rate limit check for email verification challenge resends:
 * - Per Account (max 3 per 15 min)
 * - Per Email (max 3 per 15 min)
 * - Per IP (max 5 per 15 min)
 */
export function checkResendRateLimit(
  accountId: string | undefined,
  email: string,
  ip: string
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes

  const checkBucket = (key: string, max: number): { allowed: boolean; retryAfterSec?: number } => {
    let bucket = resendRateLimitMap.get(key);
    if (!bucket) {
      bucket = [];
      resendRateLimitMap.set(key, bucket);
    }
    const valid = bucket.filter((ts) => now - ts < windowMs);
    resendRateLimitMap.set(key, valid);

    if (valid.length >= max) {
      const oldest = valid[0];
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      return { allowed: false, retryAfterSec: Math.max(1, retryAfter) };
    }
    return { allowed: true };
  };

  if (accountId) {
    const accountCheck = checkBucket(`resend:account:${accountId}`, 3);
    if (!accountCheck.allowed) return accountCheck;
  }

  const emailCheck = checkBucket(`resend:email:${email.toLowerCase()}`, 3);
  if (!emailCheck.allowed) return emailCheck;

  const ipCheck = checkBucket(`resend:ip:${ip}`, 5);
  if (!ipCheck.allowed) return ipCheck;

  // Record attempts
  if (accountId) {
    resendRateLimitMap.get(`resend:account:${accountId}`)?.push(now);
  }
  resendRateLimitMap.get(`resend:email:${email.toLowerCase()}`)?.push(now);
  resendRateLimitMap.get(`resend:ip:${ip}`)?.push(now);

  return { allowed: true };
}

/**
 * Creates an email verification challenge.
 * Returns the raw token (to be emailed or logged) and stores the SHA-256 hash.
 */
export function createEmailVerificationChallenge(
  accountOrId: { id: string; email: string } | string,
  emailOrIp?: string,
  ipArg?: string
): {
  challenge: EmailVerificationChallenge;
  rawToken: string;
} {
  let accountId: string;
  let email: string;
  let ip = '127.0.0.1';

  if (typeof accountOrId === 'object' && accountOrId !== null) {
    accountId = accountOrId.id;
    email = accountOrId.email;
    if (emailOrIp) ip = emailOrIp;
  } else {
    accountId = accountOrId;
    email = emailOrIp || '';
    if (ipArg) ip = ipArg;
  }

  if (challengesById.size === 0) {
    hydrateChallengesFromDisk();
  }

  // Invalidate any existing unconsumed challenges for this account
  for (const c of challengesById.values()) {
    if (c.accountId === accountId && !c.consumedAt) {
      c.consumedAt = Date.now(); // mark invalidated
      challengesByHash.delete(c.tokenHash);
    }
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const now = Date.now();

  const challenge: EmailVerificationChallenge = {
    id: `evc_${now}_${Math.random().toString(36).slice(2, 7)}`,
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
  persistChallengesToDisk();

  recordSecurityEvent({
    type: 'EMAIL_VERIFICATION_REQUESTED',
    accountId,
    ip,
    metadata: {
      challengeId: challenge.id,
      email,
    },
  });

  // Zero-friction offline/local fallback: log simulated verification link
  if (process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST) {
    console.log(`[DocuStack Email Verification] Challenge token for ${email}: ${rawToken}`);
  }

  return { challenge, rawToken };
}

/**
 * Verifies an email verification challenge token.
 * On success, marks account.emailVerified = true and upgrades trustLevel to T1_EMAIL_VERIFIED.
 */
export function verifyEmailChallenge(
  rawToken: string,
  ip = '127.0.0.1'
): {
  success: boolean;
  accountId?: string;
  trustLevel?: TrustLevel;
  error?: string;
} {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'MISSING_TOKEN' };
  }

  if (challengesById.size === 0) {
    hydrateChallengesFromDisk();
  }

  const tokenHash = hashToken(rawToken);
  const challenge = challengesByHash.get(tokenHash);

  if (!challenge) {
    recordSecurityEvent({
      type: 'EMAIL_VERIFICATION_FAILED',
      ip,
      metadata: { reason: 'CHALLENGE_NOT_FOUND' },
    });
    return { success: false, error: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  challenge.attemptCount++;

  if (challenge.consumedAt != null) {
    persistChallengesToDisk();
    recordSecurityEvent({
      type: 'EMAIL_VERIFICATION_FAILED',
      accountId: challenge.accountId,
      ip,
      metadata: { reason: 'TOKEN_ALREADY_CONSUMED' },
    });
    return { success: false, error: 'TOKEN_ALREADY_USED' };
  }

  const now = Date.now();
  if (now > challenge.expiresAt) {
    persistChallengesToDisk();
    recordSecurityEvent({
      type: 'EMAIL_VERIFICATION_FAILED',
      accountId: challenge.accountId,
      ip,
      metadata: { reason: 'TOKEN_EXPIRED' },
    });
    return { success: false, error: 'TOKEN_EXPIRED' };
  }

  if (challenge.attemptCount > challenge.maxAttempts) {
    persistChallengesToDisk();
    recordSecurityEvent({
      type: 'EMAIL_VERIFICATION_FAILED',
      accountId: challenge.accountId,
      ip,
      metadata: { reason: 'MAX_ATTEMPTS_EXCEEDED' },
    });
    return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED' };
  }

  // ── SUCCESS: CONSUME CHALLENGE & PROMOTE ACCOUNT ────────────────────────────────────
  challenge.consumedAt = now;
  challengesByHash.delete(tokenHash);
  persistChallengesToDisk();

  // Update Account
  const users = loadUsers();
  const user = users.find((u) => u.id === challenge.accountId);
  let newTrustLevel: TrustLevel = 'T1_EMAIL_VERIFIED';

  if (user) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date().toISOString();
    if (user.role === 'admin' || user.trustLevel === 'T4_PRIVILEGED') {
      newTrustLevel = 'T4_PRIVILEGED';
    } else {
      newTrustLevel = 'T1_EMAIL_VERIFIED';
    }
    user.trustLevel = newTrustLevel;
    saveUsers(users);
  }

  recordSecurityEvent({
    type: 'EMAIL_VERIFIED',
    accountId: challenge.accountId,
    ip,
    metadata: {
      email: challenge.email,
      newTrustLevel,
    },
  });

  return {
    success: true,
    accountId: challenge.accountId,
    trustLevel: newTrustLevel,
  };
}

/**
 * Clears challenges for testing isolation.
 */
export function clearChallengesForTest(): void {
  challengesByHash.clear();
  challengesById.clear();
  resendRateLimitMap.clear();
}

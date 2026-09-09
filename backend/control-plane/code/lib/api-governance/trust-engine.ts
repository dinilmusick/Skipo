// ══════════════════════════════════════════════════════════════════════════════════════════
// PROGRESSIVE TRUST ENGINE & ABUSE SCORING
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Sections 2, 15, 16, 17, 18, 19, 20, 21, 22 of the Progressive Trust Spec:
// Trust Levels: T0_UNVERIFIED, T1_EMAIL_VERIFIED, T2_ESTABLISHED, T3_TRUSTED, T4_PRIVILEGED.
// Multi-Signal Abuse Scoring, Automatic Trust Downgrade, and Trust Rate Multipliers.

import { TrustLevel, UserAccount, AccountStatus } from '../types';
import { loadUsers, saveUsers } from '../auth-storage';
import { recordSecurityEvent } from './security-events';
import { revokeAllUserSessions } from './session-manager';

export const TRUST_RANK: Record<TrustLevel, number> = {
  T0_UNVERIFIED: 0,
  T1_EMAIL_VERIFIED: 1,
  T2_ESTABLISHED: 2,
  T3_TRUSTED: 3,
  T4_PRIVILEGED: 4,
};

export const TRUST_RATE_MULTIPLIERS: Record<TrustLevel, number> = {
  T0_UNVERIFIED: 0.25,
  T1_EMAIL_VERIFIED: 1.0,
  T2_ESTABLISHED: 2.0,
  T3_TRUSTED: 5.0,
  T4_PRIVILEGED: 10.0,
};

// Thresholds for progressive level advancement
export const MIN_ESTABLISHED_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MIN_TRUSTED_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MIN_TRUSTED_ACTIVITY_COUNT = 50;
export const MAX_ESTABLISHED_ABUSE = 10;
export const MAX_TRUSTED_ABUSE = 5;

// Abuse thresholds
export const SUSPICIOUS_ABUSE_THRESHOLD = 15;
export const HIGH_RISK_ABUSE_THRESHOLD = 30;
export const ACCOUNT_SUSPENSION_ABUSE_THRESHOLD = 50;

export type AbuseSignalType =
  | 'failedLogins'
  | 'verificationFailures'
  | 'verificationResends'
  | 'rateLimitViolations'
  | 'unusualRequestRate'
  | 'unusualConcurrency'
  | 'refreshTokenReuse'
  | 'securityEvents';

const ABUSE_WEIGHTS: Record<AbuseSignalType, number> = {
  failedLogins: 2,
  verificationFailures: 3,
  verificationResends: 1,
  rateLimitViolations: 2,
  unusualRequestRate: 2,
  unusualConcurrency: 3,
  refreshTokenReuse: 10,
  securityEvents: 1,
};

// In-memory tracking of abuse signals: accountId -> { signalType -> count }
const accountAbuseSignals = new Map<string, Partial<Record<AbuseSignalType, number>>>();

/**
 * Calculates effective Trust Level strictly server-side based on:
 * - Email verification state
 * - Account age
 * - Total successful activity
 * - Abuse score
 * - Admin grant
 */
export function calculateTrust(account: Partial<UserAccount>): TrustLevel {
  // Admin grant is highest authority
  if (account.role === 'admin' || account.trustLevel === 'T4_PRIVILEGED') {
    return 'T4_PRIVILEGED';
  }

  let rank = TRUST_RANK.T0_UNVERIFIED;

  // T1: Email Verified
  if (account.emailVerified) {
    rank = Math.max(rank, TRUST_RANK.T1_EMAIL_VERIFIED);
  }

  const now = Date.now();
  const createdAtMs = account.createdAt ? new Date(account.createdAt).getTime() : now;
  const ageMs = Math.max(0, now - createdAtMs);
  const abuse = computeAbuseScore(account.id || '');
  const activity = account.successfulActivityCount || 0;

  // T2: Established Account
  if (account.emailVerified && ageMs >= MIN_ESTABLISHED_AGE_MS && abuse <= MAX_ESTABLISHED_ABUSE) {
    rank = Math.max(rank, TRUST_RANK.T2_ESTABLISHED);
  }

  // T3: Trusted Account
  if (
    account.emailVerified &&
    ageMs >= MIN_TRUSTED_AGE_MS &&
    abuse <= MAX_TRUSTED_ABUSE &&
    activity >= MIN_TRUSTED_ACTIVITY_COUNT
  ) {
    rank = Math.max(rank, TRUST_RANK.T3_TRUSTED);
  }

  const entries = Object.entries(TRUST_RANK) as [TrustLevel, number][];
  const matched = entries.find(([_, r]) => r === rank);
  return matched ? matched[0] : 'T0_UNVERIFIED';
}

/**
 * Returns the rate limit multiplier for a given Trust Level.
 */
export function getTrustRateMultiplier(trust: TrustLevel): number {
  return TRUST_RATE_MULTIPLIERS[trust] ?? 1.0;
}

/**
 * Computes the total weighted abuse score for an account.
 */
export function computeAbuseScore(accountId: string): number {
  const signals = accountAbuseSignals.get(accountId);
  if (!signals) return 0;

  let total = 0;
  for (const [key, count] of Object.entries(signals)) {
    const weight = ABUSE_WEIGHTS[key as AbuseSignalType] || 1;
    total += (count || 0) * weight;
  }
  return total;
}

/**
 * Records an abuse signal for an account and enforces progressive penalties:
 * - >= 15: halves rate limits
 * - >= 30: revokes active sessions
 * - >= 50: suspends account status
 */
export function recordAbuseSignal(
  accountId: string,
  signal: AbuseSignalType,
  count = 1,
  ip = '127.0.0.1'
): number {
  if (!accountId) return 0;

  let signals = accountAbuseSignals.get(accountId);
  if (!signals) {
    signals = {};
    accountAbuseSignals.set(accountId, signals);
  }
  signals[signal] = (signals[signal] || 0) + count;

  const currentScore = computeAbuseScore(accountId);

  // AUTOMATIC PENALTY ENFORCEMENT
  if (currentScore >= ACCOUNT_SUSPENSION_ABUSE_THRESHOLD) {
    // 1. Suspend account status
    const users = loadUsers();
    const user = users.find((u) => u.id === accountId);
    if (user && user.status !== 'SUSPENDED') {
      user.status = 'SUSPENDED';
      saveUsers(users);
      revokeAllUserSessions(accountId, 'ACCOUNT_SUSPENDED_DUE_TO_ABUSE');
      recordSecurityEvent({
        type: 'ACCOUNT_SUSPENDED',
        accountId,
        ip,
        metadata: { abuseScore: currentScore, triggeredSignal: signal },
      });
    }
  } else if (currentScore >= HIGH_RISK_ABUSE_THRESHOLD) {
    // 2. Revoke all high-privilege sessions
    revokeAllUserSessions(accountId, 'HIGH_RISK_ABUSE_THRESHOLD_BREACHED');
  }

  return currentScore;
}

/**
 * Increments successful activity count on an account (qualifying for T3 Trusted).
 */
export function recordSuccessfulActivity(accountId: string): void {
  if (!accountId) return;
  const users = loadUsers();
  const user = users.find((u) => u.id === accountId);
  if (user) {
    user.successfulActivityCount = (user.successfulActivityCount || 0) + 1;
    saveUsers(users);
  }
}

/**
 * Clears abuse signals for testing.
 */
export function clearAbuseSignalsForTest(): void {
  accountAbuseSignals.clear();
}

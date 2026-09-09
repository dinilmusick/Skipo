/**
 * @fileoverview Progressive Trust Engine & Abuse Scoring Template
 */

export const governanceTrustTemplate = () => `import { TrustLevel } from './types';

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

export function getTrustRateMultiplier(trust?: TrustLevel): number {
  if (!trust) return 1.0;
  return TRUST_RATE_MULTIPLIERS[trust] ?? 1.0;
}

export function calculateTrust(account: {
  role?: string;
  emailVerified?: boolean;
  createdAt?: string | number;
  abuseScore?: number;
  successfulActivityCount?: number;
}): TrustLevel {
  if (account.role === 'admin') return 'T4_PRIVILEGED';

  let rank = TRUST_RANK.T0_UNVERIFIED;
  if (account.emailVerified) rank = Math.max(rank, TRUST_RANK.T1_EMAIL_VERIFIED);

  const createdAtMs = account.createdAt ? new Date(account.createdAt).getTime() : Date.now();
  const ageMs = Date.now() - createdAtMs;

  // 7 days + low abuse -> T2 Established
  if (account.emailVerified && ageMs >= 7 * 24 * 3600 * 1000 && (account.abuseScore || 0) <= 10) {
    rank = Math.max(rank, TRUST_RANK.T2_ESTABLISHED);
  }

  // 30 days + 50 activities -> T3 Trusted
  if (
    account.emailVerified &&
    ageMs >= 30 * 24 * 3600 * 1000 &&
    (account.abuseScore || 0) <= 5 &&
    (account.successfulActivityCount || 0) >= 50
  ) {
    rank = Math.max(rank, TRUST_RANK.T3_TRUSTED);
  }

  const entries = Object.entries(TRUST_RANK) as [TrustLevel, number][];
  const matched = entries.find(([_, r]) => r === rank);
  return matched ? matched[0] : 'T0_UNVERIFIED';
}
`;

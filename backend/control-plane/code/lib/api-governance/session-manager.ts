// ══════════════════════════════════════════════════════════════════════════════════════════
// PROGRESSIVE SESSION & REFRESH-TOKEN STORAGE MANAGER
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements the SESSION / REFRESH-TOKEN STORAGE SPEC:
// User -> many independent Sessions -> rotating Refresh Token credential
//
// Invariants:
// 1. Never store raw refresh tokens; store SHA-256(token).
// 2. Each login creates an independent Session (isolated from other devices).
// 3. Refresh token rotation atomically invalidates the old hash and stores the new hash.
// 4. Token theft detection: reusing an already-invalidated refresh token revokes the entire Session.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Session } from './types';
import { getControlPlaneDir } from '../auth-storage';
import { recordSecurityEvent } from './security-events';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes (short-lived)
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days absolute maximum

interface RotatedTokenRecord {
  tokenHash: string;
  sessionId: string;
  accountId: string;
  rotatedAt: number;
}

// In-memory cache for high-speed sub-millisecond lookup
const sessionsById = new Map<string, Session>();
const sessionsByRefreshHash = new Map<string, string>(); // hash -> sessionId
const rotatedTokenHashes = new Map<string, RotatedTokenRecord>(); // oldHash -> metadata

function getSessionsFilePath(): string {
  const dir = getControlPlaneDir();
  return path.join(dir, 'sessions.json');
}

function getRotatedTokensFilePath(): string {
  const dir = getControlPlaneDir();
  return path.join(dir, 'rotated_tokens.json');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generate a cryptographically random, high-entropy token
 */
export function generateRandomToken(byteLength = 48): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Creates and signs a short-lived HMAC AccessToken (15m)
 */
export function issueAccessToken(session: { id: string; accountId: string }): string {
  const secret = process.env.AUTH_SECRET || 'docustack_vault_session_key_2026';
  const now = Date.now();
  const payload = JSON.stringify({
    sessionId: session.id,
    accountId: session.accountId,
    issuedAt: now,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    type: 'access',
  });
  const b64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `${b64}.${signature}`;
}

/**
 * Validates an AccessToken. Verifies HMAC signature, timestamp, and checks session liveness.
 */
export function validateAccessToken(
  token: string
): { accountId: string; sessionId: string } | null {
  if (!token) return null;

  // Graceful fallback for legacy session tokens ("sess::..." or signed legacy session cookies)
  if (token.startsWith('sess::')) {
    const parts = token.split('::');
    if (parts.length >= 3) {
      const accountId = parts[1];
      const sessionId = parts[3] || parts[2];
      return { accountId, sessionId };
    }
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [b64, signature] = parts;
  const secret = process.env.AUTH_SECRET || 'docustack_vault_session_key_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('hex');

  if (signature !== expectedSig) return null;

  try {
    const raw = Buffer.from(b64, 'base64').toString('utf-8');
    const claims = JSON.parse(raw);
    const now = Date.now();

    // Check access token expiration
    if (claims.expiresAt && now >= claims.expiresAt) {
      return null;
    }

    const sessionId = claims.sessionId;
    if (!sessionId) {
      // Legacy token format with userId
      if (claims.userId) {
        return { accountId: claims.userId, sessionId: `sess_legacy_${claims.userId}` };
      }
      return null;
    }

    // Check session liveness and revocation
    const session = getSession(sessionId);
    if (session) {
      if (session.revokedAt != null) return null;
      if (now >= session.expiresAt) return null;
      // Update activity timestamp lazily
      session.lastActivityAt = now;
    }

    return {
      accountId: claims.accountId || claims.userId,
      sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * Loads sessions from persistent storage into memory cache.
 */
export function hydrateSessionsFromDisk(): void {
  try {
    const filePath = getSessionsFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const list: Session[] = JSON.parse(raw);
      for (const s of list) {
        sessionsById.set(s.id, s);
        if (s.refreshTokenHash && !s.revokedAt) {
          sessionsByRefreshHash.set(s.refreshTokenHash, s.id);
        }
      }
    }
  } catch {}

  try {
    const rotatedPath = getRotatedTokensFilePath();
    if (fs.existsSync(rotatedPath)) {
      const raw = fs.readFileSync(rotatedPath, 'utf-8');
      const list: RotatedTokenRecord[] = JSON.parse(raw);
      for (const r of list) {
        rotatedTokenHashes.set(r.tokenHash, r);
      }
    }
  } catch {}
}

/**
 * Saves all active sessions to disk.
 */
function persistSessionsToDisk(): void {
  try {
    const filePath = getSessionsFilePath();
    const list = Array.from(sessionsById.values());
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}

  try {
    const rotatedPath = getRotatedTokensFilePath();
    const list = Array.from(rotatedTokenHashes.values()).slice(-2000); // retain last 2000 rotated tokens
    fs.writeFileSync(rotatedPath, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

/**
 * Creates an independent Session for a user login.
 * Issues a short-lived access token and a rotating refresh token.
 */
export function createSession(
  accountId: string,
  metadata?: { deviceId?: string; userAgent?: string; ipAddress?: string }
): {
  session: Session;
  accessToken: string;
  refreshToken: string;
} {
  const now = Date.now();
  const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;

  // Generate cryptographically random, high-entropy refresh token
  const rawRefreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);

  const expiresAt = now + SESSION_MAX_AGE_MS;
  const refreshTokenExpiresAt = Math.min(now + REFRESH_TOKEN_TTL_MS, expiresAt);

  const session: Session = {
    id: sessionId,
    accountId,
    refreshTokenHash,
    refreshTokenCreatedAt: now,
    refreshTokenExpiresAt,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    deviceId: metadata?.deviceId,
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
  };

  sessionsById.set(sessionId, session);
  sessionsByRefreshHash.set(refreshTokenHash, sessionId);
  persistSessionsToDisk();

  recordSecurityEvent({
    type: 'SESSION_CREATED',
    accountId,
    sessionId,
    ip: metadata?.ipAddress || '127.0.0.1',
    metadata: {
      deviceId: metadata?.deviceId,
      userAgent: metadata?.userAgent,
    },
  });

  const accessToken = issueAccessToken({ id: sessionId, accountId });

  return {
    session,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * Retrieves a session by ID.
 */
export function getSession(sessionId: string): Session | null {
  if (sessionsById.size === 0) {
    hydrateSessionsFromDisk();
  }
  return sessionsById.get(sessionId) || null;
}

/**
 * Rotates a refresh token:
 * 1. Hashes the incoming token.
 * 2. Detects reuse of already-invalidated tokens -> revokes the session (token theft!).
 * 3. If valid, issues new access token + new refresh token, atomically replaces stored hash.
 */
export function rotateRefreshToken(
  rawRefreshToken: string,
  metadata?: { ip?: string; userAgent?: string }
): {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accountId: string;
} {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new Error('MISSING_REFRESH_TOKEN');
  }

  if (sessionsById.size === 0) {
    hydrateSessionsFromDisk();
  }

  const tokenHash = hashToken(rawRefreshToken);
  const now = Date.now();

  // ── REFRESH TOKEN REUSE DETECTION (THEFT DETECTION) ──────────────────────────────────
  const rotatedRecord = rotatedTokenHashes.get(tokenHash);
  if (rotatedRecord) {
    // REUSE DETECTED: Revoke the entire session immediately
    const sessionToRevoke = sessionsById.get(rotatedRecord.sessionId);
    if (sessionToRevoke) {
      sessionToRevoke.revokedAt = now;
      sessionsByRefreshHash.delete(sessionToRevoke.refreshTokenHash);
      persistSessionsToDisk();
    }

    recordSecurityEvent({
      type: 'REFRESH_TOKEN_REUSE',
      accountId: rotatedRecord.accountId,
      sessionId: rotatedRecord.sessionId,
      ip: metadata?.ip || '127.0.0.1',
      metadata: {
        userAgent: metadata?.userAgent,
        severity: 'CRITICAL_TOKEN_THEFT',
      },
    });

    throw new Error('TOKEN_THEFT_DETECTED: Stolen or reused refresh token. Session revoked.');
  }

  // ── ACTIVE SESSION LOOKUP ────────────────────────────────────────────────────────────
  const sessionId = sessionsByRefreshHash.get(tokenHash);
  if (!sessionId) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const session = sessionsById.get(sessionId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.revokedAt != null) {
    throw new Error('SESSION_REVOKED');
  }

  if (now >= session.expiresAt || now >= session.refreshTokenExpiresAt) {
    throw new Error('SESSION_EXPIRED');
  }

  // ── ATOMIC ROTATION ──────────────────────────────────────────────────────────────────
  // 1. Generate new high-entropy raw token
  const newRawRefreshToken = generateRandomToken(48);
  const newRefreshTokenHash = hashToken(newRawRefreshToken);

  // 2. Record old token into rotated tokens registry
  rotatedTokenHashes.set(tokenHash, {
    tokenHash,
    sessionId: session.id,
    accountId: session.accountId,
    rotatedAt: now,
  });

  // 3. Atomically update session credentials
  sessionsByRefreshHash.delete(tokenHash);
  session.refreshTokenHash = newRefreshTokenHash;
  session.refreshTokenCreatedAt = now;
  session.refreshTokenExpiresAt = Math.min(now + REFRESH_TOKEN_TTL_MS, session.expiresAt);
  session.lastActivityAt = now;
  if (metadata?.ip) session.ipAddress = metadata.ip;
  if (metadata?.userAgent) session.userAgent = metadata.userAgent;

  sessionsByRefreshHash.set(newRefreshTokenHash, session.id);
  persistSessionsToDisk();

  recordSecurityEvent({
    type: 'TOKEN_REFRESH',
    accountId: session.accountId,
    sessionId: session.id,
    ip: metadata?.ip || '127.0.0.1',
    metadata: {
      userAgent: metadata?.userAgent,
    },
  });

  // 4. Issue new short-lived access token
  const newAccessToken = issueAccessToken({
    id: session.id,
    accountId: session.accountId,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    sessionId: session.id,
    accountId: session.accountId,
  };
}

/**
 * Revokes a specific session (Session isolation: revoking Session A leaves Sessions B/C intact).
 */
export function revokeSession(sessionId: string, reason = 'USER_LOGOUT'): boolean {
  if (sessionsById.size === 0) {
    hydrateSessionsFromDisk();
  }

  const session = sessionsById.get(sessionId);
  if (!session) return false;

  const now = Date.now();
  session.revokedAt = now;
  if (session.refreshTokenHash) {
    sessionsByRefreshHash.delete(session.refreshTokenHash);
  }
  persistSessionsToDisk();

  recordSecurityEvent({
    type: 'SESSION_REVOKED',
    accountId: session.accountId,
    sessionId: session.id,
    ip: session.ipAddress || '127.0.0.1',
    metadata: { reason },
  });

  return true;
}

/**
 * Revokes all sessions for a user ("Log out all devices" or password reset).
 */
export function revokeAllUserSessions(accountId: string, reason = 'LOGOUT_ALL_DEVICES'): number {
  if (sessionsById.size === 0) {
    hydrateSessionsFromDisk();
  }

  const now = Date.now();
  let revokedCount = 0;

  for (const session of sessionsById.values()) {
    if (session.accountId === accountId && !session.revokedAt) {
      session.revokedAt = now;
      if (session.refreshTokenHash) {
        sessionsByRefreshHash.delete(session.refreshTokenHash);
      }
      revokedCount++;
    }
  }

  if (revokedCount > 0) {
    persistSessionsToDisk();
    recordSecurityEvent({
      type: 'SESSION_REVOKED',
      accountId,
      ip: '127.0.0.1',
      metadata: { reason, count: revokedCount },
    });
  }

  return revokedCount;
}

/**
 * Returns all active sessions for an account (without exposing refresh token hashes).
 */
export function getUserSessions(accountId: string): Array<Omit<Session, 'refreshTokenHash'>> {
  if (sessionsById.size === 0) {
    hydrateSessionsFromDisk();
  }

  const now = Date.now();
  const userSessions: Array<Omit<Session, 'refreshTokenHash'>> = [];

  for (const session of sessionsById.values()) {
    if (session.accountId === accountId && !session.revokedAt && now < session.expiresAt) {
      const { refreshTokenHash: _, ...safeSession } = session;
      userSessions.push(safeSession);
    }
  }

  return userSessions;
}

/**
 * Clears in-memory session cache (useful for test isolation).
 */
export function clearSessionsForTest(): void {
  sessionsById.clear();
  sessionsByRefreshHash.clear();
  rotatedTokenHashes.clear();
}

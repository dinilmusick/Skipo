/**
 * @fileoverview Multi-Session Storage & Refresh Token Rotation Template
 */

export const governanceSessionTemplate = () => `import crypto from 'crypto';
import { Session } from './types';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface RotatedTokenRecord {
  tokenHash: string;
  sessionId: string;
  accountId: string;
  rotatedAt: number;
}

const sessionsById = new Map<string, Session>();
const sessionsByRefreshHash = new Map<string, string>();
const rotatedTokenHashes = new Map<string, RotatedTokenRecord>();

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function generateRandomToken(byteLength = 48): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function issueAccessToken(session: { id: string; accountId: string }): string {
  const secret = process.env.AUTH_SECRET || 'skipo_session_secret_key_2026';
  const now = Date.now();
  const payload = JSON.stringify({
    sessionId: session.id,
    accountId: session.accountId,
    issuedAt: now,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
  });
  const b64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return \`\${b64}.\${signature}\`;
}

export function validateAccessToken(token: string): { accountId: string; sessionId: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, signature] = parts;
  const secret = process.env.AUTH_SECRET || 'skipo_session_secret_key_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  if (signature !== expectedSig) return null;

  try {
    const raw = Buffer.from(b64, 'base64').toString('utf-8');
    const claims = JSON.parse(raw);
    const now = Date.now();
    if (claims.expiresAt && now >= claims.expiresAt) return null;

    const session = sessionsById.get(claims.sessionId);
    if (session) {
      if (session.revokedAt != null || now >= session.expiresAt) return null;
      session.lastActivityAt = now;
    }

    return { accountId: claims.accountId, sessionId: claims.sessionId };
  } catch {
    return null;
  }
}

export function createSession(
  accountId: string,
  metadata?: { deviceId?: string; userAgent?: string; ipAddress?: string }
): { session: Session; accessToken: string; refreshToken: string } {
  const now = Date.now();
  const sessionId = \`sess_\${now}_\${Math.random().toString(36).slice(2, 9)}\`;
  const rawRefreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = now + SESSION_MAX_AGE_MS;

  const session: Session = {
    id: sessionId,
    accountId,
    refreshTokenHash,
    refreshTokenCreatedAt: now,
    refreshTokenExpiresAt: Math.min(now + REFRESH_TOKEN_TTL_MS, expiresAt),
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    deviceId: metadata?.deviceId,
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
  };

  sessionsById.set(sessionId, session);
  sessionsByRefreshHash.set(refreshTokenHash, sessionId);

  const accessToken = issueAccessToken({ id: sessionId, accountId });
  return { session, accessToken, refreshToken: rawRefreshToken };
}

export function rotateRefreshToken(
  rawRefreshToken: string,
  metadata?: { ip?: string; userAgent?: string }
): { accessToken: string; refreshToken: string; sessionId: string; accountId: string } {
  if (!rawRefreshToken) throw new Error('MISSING_REFRESH_TOKEN');
  const tokenHash = hashToken(rawRefreshToken);
  const now = Date.now();

  const rotatedRecord = rotatedTokenHashes.get(tokenHash);
  if (rotatedRecord) {
    const sessionToRevoke = sessionsById.get(rotatedRecord.sessionId);
    if (sessionToRevoke) {
      sessionToRevoke.revokedAt = now;
      sessionsByRefreshHash.delete(sessionToRevoke.refreshTokenHash);
    }
    throw new Error('TOKEN_THEFT_DETECTED: Stolen or reused refresh token. Session revoked.');
  }

  const sessionId = sessionsByRefreshHash.get(tokenHash);
  if (!sessionId) throw new Error('INVALID_REFRESH_TOKEN');
  const session = sessionsById.get(sessionId);
  if (!session || session.revokedAt != null || now >= session.expiresAt) {
    throw new Error('SESSION_REVOKED_OR_EXPIRED');
  }

  const newRawRefreshToken = generateRandomToken(48);
  const newRefreshTokenHash = hashToken(newRawRefreshToken);

  rotatedTokenHashes.set(tokenHash, {
    tokenHash,
    sessionId: session.id,
    accountId: session.accountId,
    rotatedAt: now,
  });

  sessionsByRefreshHash.delete(tokenHash);
  session.refreshTokenHash = newRefreshTokenHash;
  session.refreshTokenCreatedAt = now;
  session.refreshTokenExpiresAt = Math.min(now + REFRESH_TOKEN_TTL_MS, session.expiresAt);
  session.lastActivityAt = now;
  sessionsByRefreshHash.set(newRefreshTokenHash, session.id);

  const newAccessToken = issueAccessToken({ id: session.id, accountId: session.accountId });
  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    sessionId: session.id,
    accountId: session.accountId,
  };
}

export function revokeSession(sessionId: string): boolean {
  const session = sessionsById.get(sessionId);
  if (!session) return false;
  session.revokedAt = Date.now();
  if (session.refreshTokenHash) sessionsByRefreshHash.delete(session.refreshTokenHash);
  return true;
}

export function revokeAllUserSessions(accountId: string): number {
  const now = Date.now();
  let count = 0;
  for (const session of sessionsById.values()) {
    if (session.accountId === accountId && !session.revokedAt) {
      session.revokedAt = now;
      if (session.refreshTokenHash) sessionsByRefreshHash.delete(session.refreshTokenHash);
      count++;
    }
  }
  return count;
}

export function getUserSessions(accountId: string): Array<Omit<Session, 'refreshTokenHash'>> {
  const now = Date.now();
  const list: Array<Omit<Session, 'refreshTokenHash'>> = [];
  for (const session of sessionsById.values()) {
    if (session.accountId === accountId && !session.revokedAt && now < session.expiresAt) {
      const { refreshTokenHash: _, ...safe } = session;
      list.push(safe);
    }
  }
  return list;
}
`;

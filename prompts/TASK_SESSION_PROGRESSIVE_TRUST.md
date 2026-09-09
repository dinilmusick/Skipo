# TASK: MULTI-SESSION ISOLATION, REFRESH TOKEN ROTATION & PROGRESSIVE TRUST

$$\text{SECURITY\_CHAIN}: \text{IDENTITY} \to \text{AUTH} \to \text{SESSION} \to \text{ACCESS\_TOKEN} \to \text{REFRESH\_TOKEN} \to \text{TRUST\_LEVEL} \to \text{RATE\_LIMIT} \to \text{OPERATION}$$

---

## 1. PURPOSE & ARCHITECTURAL MANDATE
This document defines the production specification for **Multi-Session Storage, Cryptographic Refresh Token Rotation, Token Theft Detection, Email Verification Challenges, and Progressive Account Trust**.

### Inviolable Invariants:
1. **User Root Cleanliness**: Credentials and session tokens are NEVER stored as monolithic fields inside the `User` entity. `User` contains account-level state and `sessions: Session[]`.
2. **Session Isolation**: Each login generates an independent `Session` record with unique device, user-agent, and IP telemetry. Revoking Session A (laptop) leaves Sessions B (phone) and C intact.
3. **No Raw Tokens in Storage**: High-entropy raw refresh tokens (48 bytes) are NEVER persisted or logged. Storage contains only `SHA-256(rawToken)`.
4. **Token Theft Detection**: Replaying an already-rotated refresh token indicates token theft $\to$ immediately revoke the entire `Session`, record `REFRESH_TOKEN_REUSE` in the audit log, and reject with HTTP 401.
5. **Progressive Trust Multipliers**: Server-derived trust levels ($T_0 \dots T_4$) scale rate limits ($0.25\times \dots 10.0\times$) and gate sensitive endpoints.
6. **Multi-Signal Abuse Penalties**: Weighted abuse scores progressively halve rate limits ($\ge 15$), revoke sessions ($\ge 30$), and suspend accounts ($\ge 50$).

---

## 2. MULTI-SESSION STORAGE SCHEMA

```ts
User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  emailVerifiedAt?: number;
  trustLevel: TrustLevel;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'DELETED';
  sessions: Session[];
}

Session {
  id: string;
  accountId: string;
  refreshTokenHash: string; // SHA-256(rawToken)
  refreshTokenCreatedAt: number;
  refreshTokenExpiresAt: number; // Max 30 days
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number; // Max 30 days absolute
  revokedAt?: number;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}
```

---

## 3. PROGRESSIVE TRUST TIERS & MULTIPLIERS

| Trust Level | Rate Multiplier | Advancement Requirements | Capability Set |
| :--- | :--- | :--- | :--- |
| `T0_UNVERIFIED` | $0.25\times$ | Default upon registration | Read-only & basic operations; restricted features |
| `T1_EMAIL_VERIFIED` | $1.0\times$ | Cryptographic email challenge verified | Full standard application capabilities |
| `T2_ESTABLISHED` | $2.0\times$ | $T_1$ + Age $\ge 7$ days + Abuse score $\le 10$ | Elevated rate limits; higher export capacities |
| `T3_TRUSTED` | $5.0\times$ | $T_1$ + Age $\ge 30$ days + 50 activities + Abuse $\le 5$ | High-throughput batch operations; beta feature access |
| `T4_PRIVILEGED` | $10.0\times$ | Admin grant or verified elevated role | Full administrative and infrastructure controls |

---

## 4. TOKEN LIFECYCLE & ROTATION PROTOCOL

```
CLIENT                              SERVER
  │                                   │
  ├────── POST /api/auth/refresh ────►│
  │      (docustack_refresh_token)    │ 1. Hash incoming token: H = SHA-256(rawToken)
  │                                   │ 2. Check rotatedTokenHashes:
  │                                   │    - If found -> THEFT DETECTED -> Revoke Session -> 401
  │                                   │ 3. Check active sessionsByRefreshHash:
  │                                   │    - If missing/expired/revoked -> 401
  │                                   │ 4. Generate new rawRefreshToken + new H_new
  │                                   │ 5. Atomically:
  │                                   │    - Move old H to rotatedTokenHashes
  │                                   │    - Update Session.refreshTokenHash = H_new
  │                                   │    - Issue 15m HMAC AccessToken
  │◄───── Set-Cookie: new tokens ─────┤
  │       HTTP 200 OK                 │
```

---

## 5. EMAIL VERIFICATION LIFECYCLE

1. **Challenge Generation**:
   - `createEmailVerificationChallenge(accountId, email, ip)` generates a cryptographically random 32-byte token.
   - Stores `SHA-256(token)`, TTL 24h, max 5 attempts.
   - Any prior unconsumed challenge for the account is atomically invalidated.
2. **Verification Execution**:
   - `GET /api/auth/verify-email?token=...` or `POST /api/auth/verify-email`.
   - On success: marks account `emailVerified = true`, sets `emailVerifiedAt`, promotes account to `T1_EMAIL_VERIFIED`.
   - Consumes challenge (`consumedAt = Date.now()`). Replay attempts are strictly blocked.
3. **Multi-Tier Resend Rate Limiting**:
   - Per Account: max 3 per 15 minutes.
   - Per Email: max 3 per 15 minutes.
   - Per IP: max 5 per 15 minutes.
   - Breaching limits returns HTTP 429 with `Retry-After`.

---

## 6. MULTI-SIGNAL ABUSE ENGINE

```
SIGNAL WEIGHTS:
  failedLogins: +2
  verificationFailures: +3
  verificationResends: +1
  rateLimitViolations: +2
  unusualRequestRate: +2
  unusualConcurrency: +3
  refreshTokenReuse: +10

AUTOMATIC PENALTY THRESHOLDS:
  Score >= 15 (SUSPICIOUS): Rate limits halved (0.5x multiplier applied)
  Score >= 30 (HIGH_RISK):  All active sessions revoked immediately
  Score >= 50 (MALICIOUS):  Account auto-suspended (status = SUSPENDED), all sessions killed, blocked at Gate 2 with 403
```

---

## 7. AUTOMATED VERIFICATION SUITE
Execute the comprehensive test suite validating all 18 test cases:
```bash
npx tsx scripts/test-session-progressive-trust.ts
bash scripts/verify-control-plane-standards.sh
```

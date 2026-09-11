# TASK: ENFORCE_SECURITY_AND_SESSION_INFRASTRUCTURE_PROTOCOL

$$\text{INVARIANT}: \text{APP\_SECURITY} \equiv \text{GatePipeline}_8 \wedge \text{MultiSessionStorage} \wedge \text{TokenRotation}_{\text{theft-safe}} \wedge \text{ProgressiveTrust}_{T_0 \to T_4}$$
$$\text{PRIORITY}: \text{Security \& Session Infrastructure} \succ \text{New Feature Logic} \succ \text{UI Layout}$$

---

## 0. PURPOSE & ACTIVATION CONTEXT

**Activate this prompt whenever there is ambiguity or uncertainty about whether an application's codebase has implemented the mandatory Skipo API Security, Multi-Session Isolation, Refresh Token Rotation, and Progressive Trust Infrastructure.**

When this prompt is invoked, the coding agent MUST:
1. **Immediately prioritize** the audit, establishment, and enforcement of security and session management infrastructure over any cosmetic, UI, or routine feature work.
2. **Execute a 7-Pillar Gap Audit** to determine exactly what exists and what is missing or non-compliant.
3. **Remediate all gaps** by implementing missing modules, wrapping raw endpoints, setting up multi-session storage, and wiring auth cookies.
4. **Run the 5-Step Verification Gate** to definitively prove that 100% of security invariants and tests pass.

---

## 1. INVIOLABLE SECURITY & SESSION INVARIANTS (ENFORCE WITHOUT EXCEPTION)

1. **Zero Monolithic Credentials on User**:
   - `User` remains an account-level entity (`id`, `email`, `role`, `emailVerified`, `trustLevel`, `status`, `sessions: Session[]`).
   - Authentication tokens, passwords, and session credentials must **never** be stored as monolithic fields directly on `User`.
2. **Strict Multi-Session Isolation**:
   - Every login generates an independent `Session` record with unique device, user-agent, and IP telemetry.
   - Logging out of Session A (e.g. laptop) leaves Session B (mobile) and Session C intact.
   - Password reset or explicit "Logout All Devices" revokes all active sessions for the account.
3. **No Raw Tokens in Storage or Logs**:
   - Raw refresh tokens are 48-byte cryptographically random strings.
   - Sent **only** to the client via `HttpOnly + Secure + SameSite=lax` cookies (`docustack_refresh_token` or `<app>_refresh_token`), and **never** stored in the database or logged.
   - Database stores strictly `SHA-256(rawToken)` in `Session.refreshTokenHash` and rotated token history.
4. **Token Theft Auto-Revocation**:
   - Reusing an already-rotated/invalidated refresh token constitutes active token theft.
   - The engine MUST immediately revoke the entire `Session`, record a `REFRESH_TOKEN_REUSE` security event in the audit log, and reject the request with HTTP 401.
5. **Canonical 8-Gate Request Pipeline**:
   - Every API endpoint MUST be wrapped with `createSecureRoute({ ... })`. Raw route exports are strictly forbidden.
   - `[0. IP Blocklist] -> [1. Validation] -> [2. Auth & Status] -> [3. Role/Trust/Email] -> [4. Rate Limit] -> [5. Concurrency/Timeout] -> [6. App Logic] -> [7. Security Headers & Telemetry]`.
   - Failure at any gate immediately halts downstream execution (`STOP -> NO_DOWNSTREAM_EXECUTION`).
6. **Server-Side Progressive Trust Hierarchy ($T_0 \dots T_4$)**:
   - $T_0$ (`T0_UNVERIFIED`, $0.25\times$), $T_1$ (`T1_EMAIL_VERIFIED`, $1.0\times$), $T_2$ (`T2_ESTABLISHED`, $2.0\times$), $T_3$ (`T3_TRUSTED`, $5.0\times$), $T_4$ (`T4_PRIVILEGED`, $10.0\times$).
   - Gated via `minimumTrustLevel` and `emailVerificationRequired` in `createSecureRoute` (reject with HTTP 403).
7. **Multi-Signal Abuse Scoring & Auto-Penalties**:
   - Score $\ge 15$: Rate limits halved ($0.5\times$ multiplier).
   - Score $\ge 30$: Active high-privilege sessions revoked immediately.
   - Score $\ge 50$: Account auto-suspended (`status = 'SUSPENDED'`), all sessions terminated, blocked at Gate 2 with HTTP 403.
8. **File Sizing & Modularity (Law C)**:
   - Hard limit of 200 lines per TypeScript file. Keep modules strictly scoped.

---

## 2. PHASE 1: THE 7-PILLAR CODEBASE GAP AUDIT

The agent MUST perform a structured inspection across the target codebase:

```text
AUDIT CHECKLIST:
[ ] Pillar 1: Types & Account Schema
    ├── UserAccount has: emailVerified, emailVerifiedAt, trustLevel, status, sessions: Session[]
    ├── Session interface has: id, accountId, refreshTokenHash, expiresAt, lastActivityAt, etc.
    └── RouteConfig / SecureSession has: minimumTrustLevel, emailVerificationRequired, sessionId, trustLevel

[ ] Pillar 2: Multi-Session & Rotation Engine (lib/api-governance/session-manager.ts)
    ├── createSession(accountId, metadata) -> { session, accessToken, refreshToken }
    ├── issueAccessToken({ id, accountId }) (15-min HMAC signed)
    ├── validateAccessToken(token) (verifies HMAC signature & session liveness)
    ├── rotateRefreshToken(rawToken, metadata) (atomic rotation & REFRESH_TOKEN_REUSE detection)
    ├── revokeSession(sessionId) (single session isolation)
    └── revokeAllUserSessions(accountId) (logout all devices)

[ ] Pillar 3: Email Verification Challenge Engine (lib/api-governance/email-verification.ts)
    ├── createEmailVerificationChallenge(account, ip) (SHA-256 hash stored, 24h TTL, 5 max attempts)
    ├── verifyEmailChallenge(rawToken, ip) (consumes challenge, promotes to T1_EMAIL_VERIFIED)
    └── checkResendRateLimit(accountId, email, ip) (account: 3/15m, email: 3/15m, IP: 5/15m)

[ ] Pillar 4: Progressive Trust & Abuse Engine (lib/api-governance/trust-engine.ts)
    ├── calculateTrust(account) -> T0_UNVERIFIED | T1_EMAIL_VERIFIED | T2_ESTABLISHED | T3_TRUSTED | T4_PRIVILEGED
    ├── getTrustRateMultiplier(trustLevel) -> 0.25 | 1.0 | 2.0 | 5.0 | 10.0
    ├── recordAbuseSignal(accountId, signal, count, ip)
    └── Automatic penalties enforced (>=15 halving, >=30 revocation, >=50 suspension)

[ ] Pillar 5: Canonical 8-Gate Pipeline Factory (lib/api-governance/create-secure-route.ts)
    ├── Gate 0: isIpBlocked (15-minute temporary ban on abuse anomaly)
    ├── Gate 1: validateIncomingRequest (method, content-type, content-length, schema)
    ├── Gate 2: authenticateRequest + reject session.status !== 'ACTIVE' with HTTP 403
    ├── Gate 3: requiredRole + emailVerificationRequired + minimumTrustLevel (HTTP 403)
    ├── Gate 4: checkGovernanceRateLimit scaled by getTrustRateMultiplier and abuse penalties
    ├── Gate 5: acquireConcurrencySlot + executeWithTimeout
    ├── Gate 6: Application logic execution + recordSuccessfulActivity on 2xx
    └── Gate 7: applySecurityHeaders + recordRequestMetric + handleSecureApiError

[ ] Pillar 6: Dedicated Auth Endpoints (app/api/auth/)
    ├── POST /api/auth/login: calls createSession, returns tokens, attaches HttpOnly cookies
    ├── POST /api/auth/logout: calls revokeSession or revokeAllUserSessions, clears auth cookies
    ├── GET  /api/auth/me: returns safe user, trustLevel, emailVerified, activeSessionsCount
    ├── POST /api/auth/register: creates session, creates email challenge, attaches cookies
    ├── POST /api/auth/refresh: calls rotateRefreshToken, detects reuse theft, attaches cookies
    ├── GET|POST /api/auth/verify-email: calls verifyEmailChallenge, promotes to T1
    └── POST /api/auth/resend-verification: checks multi-tier rate limit, issues new challenge

[ ] Pillar 7: Edge Security Middleware & Route Coverage
    ├── middleware.ts active with isIpBlocked and security headers
    └── 100% of API routes in app/api/ wrapped with createSecureRoute (zero unwrapped routes)

[ ] Pillar 8: Real-Time Stream & Client Sync Throttling (Anti-Self-DoS / Anti-Polling)
    ├── EventSource onerror unconditionally calls eventSource.close() immediately
    ├── Permanent circuit breaker halts retries on HTTP 401, 403, or 429 until re-auth
    ├── Jittered exponential backoff (5s -> 120s with +/- 15% random jitter)
    ├── Hard retry ceiling of max 5 reconnect attempts before entering idle state
    ├── Tab visibility suspension: pauses reconnect timers when document.hidden is true
    └── Zero aggressive polling loops (< 5000ms intervals) for network requests
```

---

## 3. PHASE 2: GAP REMEDIATION & BOOTSTRAP PROTOCOL

If any items in the checklist are missing or non-compliant:
1. **Source Canonical Reference**:
   - Copy canonical governance modules from `Skipo/backend/control-plane/code/lib/api-governance/` or generate via `packages/create-skipo` templates.
2. **Hydrate Account State**:
   - Update `lib/auth-storage.ts` or user persistence layer with `normalizeUserAccount` to ensure existing accounts receive default `trustLevel`, `emailVerified`, `status`, and `sessions: []`.
   - Implement `attachAuthCookies(response, tokens)` (15-min session cookie, 30-day refresh cookie) and `clearAuthCookies(response)`.
3. **Wrap All Unwrapped Endpoints**:
   - Find all unwrapped routes:
     ```bash
     find app/api -type f -name "route.ts" -exec grep -L "createSecureRoute" {} +
     ```
   - Convert every raw export to `createSecureRoute({ id, method, ... })`.
4. **Implement Missing Auth Routes**:
   - Create `app/api/auth/refresh/route.ts`, `app/api/auth/verify-email/route.ts`, and `app/api/auth/resend-verification/route.ts`.

---

## 4. PHASE 3: THE MANDATORY 5-STEP VALIDATION GATE

The agent MUST execute the following 5 verification steps sequentially and achieve **100% PASS** with zero warnings or errors:

### Step 1: Multi-Session & Progressive Trust Test Suite
Execute the dedicated 18-step verification suite:
```bash
npx tsx scripts/test-session-progressive-trust.ts
```
*Expected*: `18 PASSED, 0 FAILED` (verifying multi-session isolation, token rotation, theft detection, replay block, resend rate limit, trust promotion, feature gating, and abuse penalties).

### Step 2: 8-Gate Security Governance Test Suite
Execute the 15-step governance pipeline verifier:
```bash
npx tsx scripts/test-api-security-governance.ts
```
*Expected*: `15 Passed, 0 Failed` (verifying Gate 0 through Gate 7, IP blocklist, rate limiting, and execution timeouts).

### Step 3: Control Plane Architectural Standards Verification
Execute the compliance scanner (including Check 34):
```bash
bash scripts/verify-control-plane-standards.sh
```
*Expected*: `🎉 AUDIT SUCCESS: All Control Plane, Auth, and UI standards strictly satisfied!`

### Step 4: Static Typecheck
```bash
npx tsc --noEmit
# Or in a monorepo:
pnpm typecheck
```
*Expected*: Exit code 0, zero type errors.

### Step 5: Full Production Build
```bash
npm run build
# Or in a monorepo:
pnpm build
```
*Expected*: Successful compilation and optimization of all dynamic API routes.

---

## 5. PHASE 4: TELEMETRY & COMPLETION AUDIT REPORT

Once all 5 validation steps pass, the agent MUST produce a structured audit report summarizing:
1. **Pillars Evaluated & Remediated**: Breakdown of audited components and newly established modules.
2. **Total API Routes Secured**: Total count of routes wrapped with `createSecureRoute` (confirming 0 unwrapped).
3. **Security Invariants Confirmed**:
   - Raw tokens never persisted or logged.
   - Refresh token reuse actively detected and auto-revoked.
   - Multi-session isolation intact across devices.
   - Progressive trust gating ($T_0 \dots T_4$) and multi-signal abuse penalties operational.
4. **Automated Test Results**: Full pass counts for `test-session-progressive-trust.ts`, `test-api-security-governance.ts`, and `verify-control-plane-standards.sh`.

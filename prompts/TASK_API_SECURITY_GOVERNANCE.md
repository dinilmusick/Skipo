# TASK: API SECURITY & RESOURCE GOVERNANCE PIPELINE

$$\text{INVARIANT}: \text{UI\_CAPABILITY\_SET} \equiv \text{API\_CAPABILITY\_SET}$$
$$\text{AUTH\_FLOW}: \langle \text{LOGIN\_ID}, \text{PASSWORD} \rangle \xrightarrow{\text{verify}} \text{AUTHENTICATED\_SESSION} \xrightarrow{\text{authorize}} \text{FULL\_USER\_CAPABILITIES}$$

---

## 1. PURPOSE & ARCHITECTURAL MANDATE
Every endpoint, whether in Next.js App Router, Express, or microservices, MUST pass through the canonical 8-Gate Pipeline before any application logic or database interaction occurs. Failure at ANY gate halts downstream processing immediately (`STOP -> NO_DOWNSTREAM_EXECUTION`).

This protects system resources, prevents CPU/database exhaustion attacks, and ensures malicious bots and scrapers are rejected with zero overhead.

---

## 2. THE CANONICAL 8-GATE REQUEST PROCESSING PIPELINE

```
REQUEST
  │
  ▼
[GATE 0: IP BLOCKLIST]            ──(banned IP: 15m ban)───────► HTTP 403 Forbidden (0 CPU/DB cost)
  │
  ▼
[GATE 1: REQUEST VALIDATION]      ──(bad method/type/length)───► HTTP 400 / 405 / 413 / 415 / 422
  │
  ▼
[GATE 2: AUTHENTICATION]          ──(invalid/missing session)──► HTTP 401 Unauthorized
  │
  ▼
[GATE 3: AUTHORIZATION]           ──(role check failure)───────► HTTP 403 Forbidden
  │
  ▼
[GATE 4: RATE LIMITING]           ──(tier rate exceeded)───────► HTTP 429 Too Many Requests
  │
  ▼
[GATE 5: RESOURCE BUDGETING]      ──(concurrency/timeout)──────► HTTP 503 / 504 (Clamped Limit)
  │
  ▼
[GATE 6: APPLICATION LOGIC]       ──(unhandled exception)──────► HTTP 500 (Sanitized incident ID)
  │
  ▼
[GATE 7: HEADERS & OBSERVABILITY] ──(attach security headers)──► Final Secured Response
```

---

## 3. RATE LIMITING TIERS & CONCURRENCY BUDGETS

### Multi-Tier Rate Limiting
| Tier | Capacity | Window | Typical Target Endpoints |
| :--- | :--- | :--- | :--- |
| `CHEAP_READ` | 120 req | 1 minute | `/api/health`, `/api/categories`, `/api/wallpapers`, lightweight queries |
| `NORMAL_MUTATION` | 60 req | 1 minute | State modifications, document creation/edits, node additions |
| `EXPENSIVE_OPERATION` | 20 req | 1 minute | Bulk export/import, sync-clones, database ping, AI doc analysis |
| `AUTHENTICATION` | 25 req | 15 minutes | `/api/auth/login`, `/api/auth/register`, credential changes |

### Resource Limits
- **Max Body Size**: Default 1MB (`1048576` bytes); Large uploads max 50MB. Enforced pre-flight via `Content-Length`.
- **Max Query String**: 2048 characters (HTTP 413).
- **Execution Timeout**: Default 8000ms; Expensive 30000ms. Aborted with `AbortSignal`.
- **Pagination Limit**: Automatically clamped to max safe cap (default 50, ceiling 100).
- **In-flight Concurrency**: Per-route concurrency slots with automatic release in `finally` blocks.

### Abuse Anomaly Auto-Blocking
- Monitored Anomalies: 401 spikes, 403 spikes, 429 spikes, 5xx bursts, request bursts.
- Penalty: Automatic 15-minute ban in an in-memory blocklist. Gate 0 rejects offending IPs with zero CPU/DB cost.

---

## 4. CANONICAL NEXT.JS APP ROUTER ROUTE WRAPPER

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'CHEAP_READ',
  public: false,
  requiredRoles: ['USER'],
  async handler(req: NextRequest, ctx) {
    return NextResponse.json({
      success: true,
      user: ctx.user,
      data: []
    });
  }
});

export const POST = createSecureRoute({
  rateLimitTier: 'NORMAL_MUTATION',
  public: false,
  requiredRoles: ['USER'],
  schema: {
    requiredFields: ['name', 'description'],
    types: { name: 'string', description: 'string' }
  },
  async handler(req: NextRequest, ctx) {
    const body = await req.json();
    return NextResponse.json({ success: true, created: body }, { status: 201 });
  }
});
```

---

## 5. EDGE MIDDLEWARE SCANNER BLOCKING
In `middleware.ts` at the project root:
- Drop known scanner/bot paths immediately (`.php`, `wp-admin`, `.env`, `cgi-bin`, `solr`, `xmlrpc.php`).
- Intercept banned IPs from the shared blocklist.
- Inject baseline security headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `X-Request-Id` (UUIDv4)

---

## 6. VERIFICATION PROTOCOL
Before marking any API task complete:
1. `npx tsc --noEmit` MUST pass with 0 errors.
2. `npm run build` MUST pass successfully.
3. Automated security test suite (`scripts/test-api-security-governance.ts`) MUST achieve 100% passing tests:
   - Rate limit enforcement & headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
   - Authentication & role-based rejection (401 / 403).
   - Method gating (405 + `Allow` header).
   - Content-Type enforcement (415).
   - Payload size limits (413).
   - Abuse anomaly detection and IP blocklist isolation.

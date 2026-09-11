#!/usr/bin/env node

// src/index.ts
import { parseArgs } from "util";

// src/generators/nextjs.ts
import { promises as fs } from "fs";
import { join, dirname } from "path";

// src/generators/nextjs-templates.ts
var nextjsTemplates = {
  packageJson: (projectName) => JSON.stringify({
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    },
    dependencies: {
      "react": "^18",
      "react-dom": "^18",
      "next": "^14",
      "@skipo/core": "latest",
      "@skipo/ui": "latest",
      "@skipo/backend": "latest",
      "@skipo/systems": "latest",
      "@skipo/validate": "latest"
    },
    devDependencies: {
      "typescript": "^5",
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "postcss": "^8",
      "tailwindcss": "^3.4.1"
    }
  }, null, 2),
  tsconfigJson: () => JSON.stringify({
    "compilerOptions": {
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  }, null, 2),
  nextConfigJs: () => `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
`,
  layoutTsx: () => `import { SkipoThemeProvider } from '@skipo/ui';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkipoThemeProvider>
          {children}
        </SkipoThemeProvider>
      </body>
    </html>
  );
}
`,
  pageTsx: () => `import { PageContainer, BaseButton, BaseCard, BaseBadge } from '@skipo/ui';

export default function Home() {
  return (
    <PageContainer>
      <BaseCard>
        <h1>Welcome to Skipo</h1>
        <BaseBadge>New</BaseBadge>
        <BaseButton>Get Started</BaseButton>
      </BaseCard>
    </PageContainer>
  );
}
`,
  loginPageTsx: () => `import { BaseCard } from '@skipo/ui';
// import { useAuth } from '@skipo/backend/hooks'; // Assuming hooks exist

export default function Login() {
  return (
    <BaseCard>
      <h2>Login</h2>
      {/* Auth components go here */}
    </BaseCard>
  );
}
`,
  adminLoginPageTsx: () => `import { BaseCard } from '@skipo/ui';

export default function AdminLogin() {
  return (
    <BaseCard>
      <h2>Admin Login</h2>
    </BaseCard>
  );
}
`,
  adminPageTsx: () => `import { PageContainer } from '@skipo/ui';

export default function AdminDashboard() {
  return (
    <PageContainer>
      <h2>Admin Dashboard</h2>
    </PageContainer>
  );
}
`,
  authRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'AUTHENTICATION',
  public: true,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Auth API Route' });
  }
});
`,
  eventsRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'CHEAP_READ',
  public: false,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Events Endpoint' });
  }
});
`,
  workspaceRouteTs: () => `import { NextRequest, NextResponse } from 'next/server';
import { createSecureRoute } from '@/lib/api-governance';

export const GET = createSecureRoute({
  rateLimitTier: 'NORMAL_MUTATION',
  public: false,
  async handler(req: NextRequest) {
    return NextResponse.json({ message: 'Workspace API' });
  }
});
`,
  customComponentTsx: () => `import { BaseButton } from '@skipo/ui';

export function CustomButton(props: any) {
  return <BaseButton {...props} />;
}
`,
  createAdminTs: () => `console.log('Create admin script');
`,
  validateTs: () => `// import { validate } from 'skipo-validate';
console.log('Validate script');
`,
  agentStateJson: () => JSON.stringify({ turnCounter: 0 }, null, 2),
  gitignore: () => `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
/.next/
.turbo/
`
};

// src/generators/templates/governance-types.ts
var governanceTypesTemplate = () => `import { NextRequest, NextResponse } from 'next/server';

export type RateLimitTier =
  | 'CHEAP_READ'
  | 'NORMAL_MUTATION'
  | 'EXPENSIVE_OPERATION'
  | 'AUTHENTICATION';

export type AbuseAnomalyType =
  | '401_SPIKE'
  | '403_SPIKE'
  | '429_SPIKE'
  | '5xx_SPIKE'
  | 'REQUEST_RATE_SPIKE';

export interface RateLimitConfig {
  capacity: number;
  windowMs: number;
}

export interface ResourceLimitsConfig {
  maxBodySizeBytes?: number;
  maxQueryLength?: number;
  maxParamLength?: number;
  timeoutMs?: number;
  executionTimeoutMs?: number;
  maxPaginationLimit?: number;
  maxConcurrencySlots?: number;
}

export interface RequestSchema {
  requiredFields?: string[];
  types?: Record<string, string>;
  maxLength?: Record<string, number>;
}

export interface SecureRouteConfig {
  rateLimitTier?: RateLimitTier;
  public?: boolean;
  requiredRoles?: string[];
  resourceLimits?: ResourceLimitsConfig;
  schema?: RequestSchema;
  handler: (req: NextRequest, context: SecureRequestContext) => Promise<NextResponse | Response>;
}

export interface SecureRequestContext {
  user?: {
    id: string;
    username: string;
    role: string;
    workspaceId?: string;
  };
  clientIp: string;
  requestId: string;
  routeParams?: any;
  params?: any;
}
`;

// src/generators/templates/governance-rate-limiter.ts
var governanceRateLimiterTemplate = () => `import { RateLimitTier, RateLimitConfig } from './types';

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  CHEAP_READ: { capacity: 120, windowMs: 60 * 1000 },
  NORMAL_MUTATION: { capacity: 60, windowMs: 60 * 1000 },
  EXPENSIVE_OPERATION: { capacity: 20, windowMs: 60 * 1000 },
  AUTHENTICATION: { capacity: 25, windowMs: 15 * 60 * 1000 }
};

interface WindowBucket {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private buckets = new Map<string, WindowBucket>();

  public check(key: string, tier: RateLimitTier): { allowed: boolean; limit: number; remaining: number; resetMs: number } {
    const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.NORMAL_MUTATION;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= config.capacity) {
      const oldest = bucket.timestamps[0];
      const resetMs = oldest ? Math.max(0, oldest + config.windowMs - now) : config.windowMs;
      return { allowed: false, limit: config.capacity, remaining: 0, resetMs };
    }

    bucket.timestamps.push(now);
    return {
      allowed: true,
      limit: config.capacity,
      remaining: config.capacity - bucket.timestamps.length,
      resetMs: config.windowMs
    };
  }
}

export const rateLimiter = new InMemoryRateLimiter();
`;

// src/generators/templates/governance-abuse.ts
var governanceAbuseDetectorTemplate = () => `import { AbuseAnomalyType } from './types';

const BLOCKLIST_BAN_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AbuseAnomalyDetector {
  private blockedIps = new Map<string, number>();
  private anomalyCounters = new Map<string, { count: number; windowStart: number }>();

  public isIpBlocked(ip: string): boolean {
    const banExpiresAt = this.blockedIps.get(ip);
    if (!banExpiresAt) return false;
    if (Date.now() > banExpiresAt) {
      this.blockedIps.delete(ip);
      return false;
    }
    return true;
  }

  public blockIp(ip: string, durationMs = BLOCKLIST_BAN_DURATION_MS): void {
    this.blockedIps.set(ip, Date.now() + durationMs);
  }

  public recordStatus(ip: string, statusCode: number): void {
    if (statusCode === 401) this.incrementAnomaly(ip, '401_SPIKE', 10, 60000);
    else if (statusCode === 403) this.incrementAnomaly(ip, '403_SPIKE', 10, 60000);
    else if (statusCode === 429) this.incrementAnomaly(ip, '429_SPIKE', 15, 60000);
    else if (statusCode >= 500) this.incrementAnomaly(ip, '5xx_SPIKE', 20, 60000);
  }

  private incrementAnomaly(ip: string, type: AbuseAnomalyType, threshold: number, windowMs: number): void {
    const key = \`\${ip}:\${type}\`;
    const now = Date.now();
    let record = this.anomalyCounters.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { count: 0, windowStart: now };
      this.anomalyCounters.set(key, record);
    }
    record.count++;
    if (record.count >= threshold) {
      this.blockIp(ip);
    }
  }
}

export const abuseDetector = new AbuseAnomalyDetector();
export const isIpBlocked = (ip: string) => abuseDetector.isIpBlocked(ip);
export const recordRequestOutcome = (ip: string, statusCode: number) => abuseDetector.recordStatus(ip, statusCode);
`;

// src/generators/templates/governance-budget.ts
var governanceBudgetTemplate = () => `import { ResourceLimitsConfig } from './types';

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimitsConfig> = {
  maxBodySizeBytes: 1048576, // 1MB
  maxQueryLength: 2048,
  maxParamLength: 256,
  timeoutMs: 8000,
  executionTimeoutMs: 8000,
  maxPaginationLimit: 100,
  maxConcurrencySlots: 25
};

const activeSlotsByRoute = new Map<string, number>();

export function acquireConcurrencySlot(routeKey: string, maxSlots = 25): boolean {
  const current = activeSlotsByRoute.get(routeKey) || 0;
  if (current >= maxSlots) return false;
  activeSlotsByRoute.set(routeKey, current + 1);
  return true;
}

export function releaseConcurrencySlot(routeKey: string): void {
  const current = activeSlotsByRoute.get(routeKey) || 0;
  if (current <= 1) {
    activeSlotsByRoute.delete(routeKey);
  } else {
    activeSlotsByRoute.set(routeKey, current - 1);
  }
}

export function clampPaginationLimit(limit: number | undefined, maxLimit = 100): number {
  if (!limit || isNaN(limit) || limit <= 0) return 50;
  return Math.min(limit, maxLimit);
}

export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Request execution timed out'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}
`;

// src/generators/templates/governance-validator.ts
var governanceValidatorTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { RequestSchema } from './types';

export function validateContentLength(req: NextRequest, maxSizeBytes: number): NextResponse | null {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const len = parseInt(contentLengthHeader, 10);
    if (!isNaN(len) && len > maxSizeBytes) {
      return NextResponse.json(
        { error: 'Payload Too Large', message: \`Payload exceeds \${maxSizeBytes} bytes limit\` },
        { status: 413 }
      );
    }
  }
  return null;
}

export function validateContentType(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers.get('content-type') || '';
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Unsupported Media Type', message: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }
  }
  return null;
}

export function validateQueryLength(req: NextRequest, maxQueryLength = 2048): NextResponse | null {
  const search = req.nextUrl.search;
  if (search && search.length > maxQueryLength) {
    return NextResponse.json(
      { error: 'URI Too Long', message: 'Query string exceeds maximum allowed length' },
      { status: 413 }
    );
  }
  return null;
}

export function validateSchema(body: any, schema?: RequestSchema): string | null {
  if (!schema) return null;
  if (schema.requiredFields) {
    for (const field of schema.requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return \`Missing required field: \${field}\`;
      }
    }
  }
  if (schema.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (body[field] !== undefined && typeof body[field] !== expectedType) {
        return \`Field '\${field}' must be of type \${expectedType}\`;
      }
    }
  }
  return null;
}
`;

// src/generators/templates/governance-headers.ts
var governanceHeadersTemplate = () => `import { NextResponse } from 'next/server';

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' *;"
};

export function applySecurityHeaders(res: NextResponse | Response, requestId: string): void {
  for (const [header, val] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(header)) {
      res.headers.set(header, val);
    }
  }
  res.headers.set('X-Request-Id', requestId);
}
`;

// src/generators/templates/governance-observability.ts
var governanceObservabilityTemplate = () => `export interface TelemetryRecord {
  requestId: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  clientIp: string;
  timestamp: string;
}

class ObservabilityRingBuffer {
  private buffer: TelemetryRecord[] = [];
  private readonly maxCapacity = 500;

  public record(entry: TelemetryRecord): void {
    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  public getRecent(count = 50): TelemetryRecord[] {
    return this.buffer.slice(-count);
  }
}

export const observabilityBuffer = new ObservabilityRingBuffer();
`;
var governanceErrorHandlerTemplate = () => `import { NextResponse } from 'next/server';

export function handleSecureRouteError(err: any, requestId: string): NextResponse {
  console.error(\`[API Error] [Request: \${requestId}]:\`, err);
  const isTimeout = err?.message?.includes('timed out');
  const status = isTimeout ? 504 : 500;
  const message = isTimeout ? 'Request execution timed out' : 'Internal Server Error';

  return NextResponse.json(
    {
      error: message,
      incidentId: requestId,
      status
    },
    { status }
  );
}
`;

// src/generators/templates/governance-route.ts
var governanceRouteTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { SecureRouteConfig, SecureRequestContext } from './types';
import { rateLimiter } from './rate-limiter';
import { isIpBlocked, recordRequestOutcome } from './abuse-detector';
import {
  DEFAULT_RESOURCE_LIMITS,
  acquireConcurrencySlot,
  releaseConcurrencySlot,
  executeWithTimeout
} from './resource-budget';
import {
  validateContentLength,
  validateContentType,
  validateQueryLength,
  validateSchema
} from './request-validator';
import { applySecurityHeaders } from './security-headers';
import { handleSecureRouteError } from './error-handler';
import { observabilityBuffer } from './observability';

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export function createSecureRoute(config: SecureRouteConfig) {
  return async (req: NextRequest, routeContext: any = {}): Promise<NextResponse | Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const clientIp = extractClientIp(req);
    const tier = config.rateLimitTier || 'NORMAL_MUTATION';
    const limits = { ...DEFAULT_RESOURCE_LIMITS, ...config.resourceLimits };
    const routeKey = \`\${req.method}:\${req.nextUrl.pathname}\`;

    // Gate 0: IP Blocklist
    if (isIpBlocked(clientIp)) {
      return NextResponse.json({ error: 'Forbidden', message: 'IP address temporarily banned' }, { status: 403 });
    }

    // Gate 1: Request Validation
    const clError = validateContentLength(req, limits.maxBodySizeBytes);
    if (clError) { recordRequestOutcome(clientIp, 413); return clError; }

    const ctError = validateContentType(req);
    if (ctError) { recordRequestOutcome(clientIp, 415); return ctError; }

    const queryError = validateQueryLength(req, limits.maxQueryLength);
    if (queryError) { recordRequestOutcome(clientIp, 413); return queryError; }

    // Gate 2 & 3: Authentication & Authorization (context populated for handlers)
    const context: SecureRequestContext = {
      clientIp,
      requestId,
      routeParams: routeContext?.params,
      params: routeContext?.params
    };

    // Gate 4: Rate Limiting
    const rateCheck = rateLimiter.check(\`\${clientIp}:\${req.nextUrl.pathname}\`, tier);
    if (!rateCheck.allowed) {
      recordRequestOutcome(clientIp, 429);
      const res = NextResponse.json(
        { error: 'Too Many Requests', retryAfterMs: rateCheck.resetMs },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateCheck.resetMs / 1000).toString() } }
      );
      applySecurityHeaders(res, requestId);
      return res;
    }

    // Gate 5: Concurrency Budget
    if (!acquireConcurrencySlot(routeKey, limits.maxConcurrencySlots)) {
      recordRequestOutcome(clientIp, 503);
      return NextResponse.json({ error: 'Service Unavailable', message: 'Too many concurrent requests' }, { status: 503 });
    }

    try {
      // Schema validation on body
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && config.schema) {
        const cloned = req.clone();
        const json = await cloned.json().catch(() => null);
        if (json) {
          const schemaErr = validateSchema(json, config.schema);
          if (schemaErr) {
            recordRequestOutcome(clientIp, 422);
            return NextResponse.json({ error: 'Unprocessable Entity', message: schemaErr }, { status: 422 });
          }
        }
      }

      // Gate 6: Application Logic
      const effectiveTimeout = limits.executionTimeoutMs ?? limits.timeoutMs;
      const res = await executeWithTimeout(() => config.handler(req, context), effectiveTimeout);

      // Gate 7: Security Headers & Observability
      applySecurityHeaders(res, requestId);
      recordRequestOutcome(clientIp, res.status);
      observabilityBuffer.record({
        requestId,
        route: req.nextUrl.pathname,
        method: req.method,
        statusCode: res.status,
        durationMs: Date.now() - startTime,
        clientIp,
        timestamp: new Date().toISOString()
      });

      return res;
    } catch (err: any) {
      recordRequestOutcome(clientIp, 500);
      const errorRes = handleSecureRouteError(err, requestId);
      applySecurityHeaders(errorRes, requestId);
      return errorRes;
    } finally {
      releaseConcurrencySlot(routeKey);
    }
  };
}
`;

// src/generators/templates/governance-middleware.ts
var governanceMiddlewareTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { isIpBlocked } from './src/lib/api-governance/abuse-detector';
import { SECURITY_HEADERS } from './src/lib/api-governance/security-headers';

const SCANNER_EXTENSIONS = ['.php', '.asp', '.aspx', '.jsp', '.cgi', '.env', '.git'];
const SCANNER_PATHS = ['/wp-admin', '/wp-login', '/cgi-bin', '/solr', '/xmlrpc.php', '/actuator'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.toLowerCase();
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';

  if (isIpBlocked(ip)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (SCANNER_PATHS.some((p) => path.startsWith(p)) || SCANNER_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
`;

// src/generators/templates/governance-index.ts
var governanceIndexTemplate = () => `export * from './types';
export * from './rate-limiter';
export * from './abuse-detector';
export * from './resource-budget';
export * from './request-validator';
export * from './security-headers';
export * from './error-handler';
export * from './observability';
export * from './create-secure-route';
`;

// src/generators/templates/governance-session.ts
var governanceSessionTemplate = () => `import crypto from 'crypto';
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

// src/generators/templates/governance-email-verification.ts
var governanceEmailVerificationTemplate = () => `import crypto from 'crypto';
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

// src/generators/templates/governance-trust.ts
var governanceTrustTemplate = () => `import { TrustLevel } from './types';

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

// src/generators/templates/governance-security-events.ts
var governanceSecurityEventsTemplate = () => `export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: string;
  accountId?: string;
  sessionId?: string;
  ip: string;
  metadata?: Record<string, any>;
}

const events: SecurityEvent[] = [];
const MAX_EVENTS = 1000;

export function recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
  const fullEvent: SecurityEvent = {
    ...event,
    id: \`sec_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}\`,
    timestamp: Date.now(),
  };

  events.push(fullEvent);
  if (events.length > MAX_EVENTS) events.shift();
  return fullEvent;
}

export function getSecurityEvents(): SecurityEvent[] {
  return [...events];
}
`;

// src/generators/nextjs.ts
async function writeFile(path, content) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf-8");
}
async function generateNextjs(projectName, _skipGit, _skipInstall) {
  const projectDir = join(process.cwd(), projectName);
  await fs.mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "package.json"), nextjsTemplates.packageJson(projectName));
  await writeFile(join(projectDir, "tsconfig.json"), nextjsTemplates.tsconfigJson());
  await writeFile(join(projectDir, "next.config.js"), nextjsTemplates.nextConfigJs());
  await writeFile(join(projectDir, ".gitignore"), nextjsTemplates.gitignore());
  await writeFile(join(projectDir, "src", "app", "globals.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
  await writeFile(join(projectDir, "src", "app", "layout.tsx"), nextjsTemplates.layoutTsx());
  await writeFile(join(projectDir, "src", "app", "page.tsx"), nextjsTemplates.pageTsx());
  await writeFile(join(projectDir, "src", "app", "login", "page.tsx"), nextjsTemplates.loginPageTsx());
  await writeFile(join(projectDir, "src", "app", "admin", "login", "page.tsx"), nextjsTemplates.adminLoginPageTsx());
  await writeFile(join(projectDir, "src", "app", "admin", "page.tsx"), nextjsTemplates.adminPageTsx());
  await writeFile(join(projectDir, "src", "app", "api", "auth", "[...route]", "route.ts"), nextjsTemplates.authRouteTs());
  await writeFile(join(projectDir, "src", "app", "api", "events", "route.ts"), nextjsTemplates.eventsRouteTs());
  await writeFile(join(projectDir, "src", "app", "api", "workspace", "route.ts"), nextjsTemplates.workspaceRouteTs());
  await writeFile(join(projectDir, "middleware.ts"), governanceMiddlewareTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "types.ts"), governanceTypesTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "rate-limiter.ts"), governanceRateLimiterTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "abuse-detector.ts"), governanceAbuseDetectorTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "resource-budget.ts"), governanceBudgetTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "request-validator.ts"), governanceValidatorTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "security-headers.ts"), governanceHeadersTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "observability.ts"), governanceObservabilityTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "error-handler.ts"), governanceErrorHandlerTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "create-secure-route.ts"), governanceRouteTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "session-manager.ts"), governanceSessionTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "email-verification.ts"), governanceEmailVerificationTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "trust-engine.ts"), governanceTrustTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "security-events.ts"), governanceSecurityEventsTemplate());
  await writeFile(join(projectDir, "src", "lib", "api-governance", "index.ts"), governanceIndexTemplate());
  await writeFile(join(projectDir, "src", "components", "CustomButton.tsx"), nextjsTemplates.customComponentTsx());
  await writeFile(join(projectDir, "scripts", "create-admin.ts"), nextjsTemplates.createAdminTs());
  await writeFile(join(projectDir, "scripts", "validate.ts"), nextjsTemplates.validateTs());
  await writeFile(join(projectDir, ".skipo", "agent-state.json"), nextjsTemplates.agentStateJson());
  console.log("Next.js project setup complete.");
}

// src/generators/react-vite.ts
import { promises as fs2 } from "fs";
import { join as join2 } from "path";
async function generateReactVite(projectName, _skipGit, _skipInstall) {
  const projectDir = join2(process.cwd(), projectName);
  const srcDir = join2(projectDir, "src");
  const compDir = join2(srcDir, "components", "AppShell");
  await fs2.mkdir(compDir, { recursive: true });
  const pkgJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc -b && vite build",
      preview: "vite preview"
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "@skipo/core": "latest",
      "@skipo/ui": "latest",
      "@skipo/backend": "latest",
      "@skipo/systems": "latest"
    },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      typescript: "^5.5.3",
      vite: "^5.4.1"
    }
  };
  await fs2.writeFile(join2(projectDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf-8");
  const gitignoreContent = `.DS_Store
*.log
node_modules/
/dist/
.turbo/
`;
  await fs2.writeFile(join2(projectDir, ".gitignore"), gitignoreContent, "utf-8");
  const vercelJson = {
    rewrites: [
      { source: "/api/(.*)", destination: "/api" },
      { source: "/(.*)", destination: "/index.html" }
    ]
  };
  await fs2.writeFile(join2(projectDir, "vercel.json"), JSON.stringify(vercelJson, null, 2), "utf-8");
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
  await fs2.writeFile(join2(projectDir, "vite.config.ts"), viteConfig, "utf-8");
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: false,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true
    },
    include: ["src"]
  };
  await fs2.writeFile(join2(projectDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf-8");
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  await fs2.writeFile(join2(projectDir, "index.html"), indexHtml, "utf-8");
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import '@skipo/ui/dist/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  await fs2.writeFile(join2(srcDir, "main.tsx"), mainTsx, "utf-8");
  const appTsx = `import React from 'react';
import { BackendProvider, BackendResolver } from '@skipo/backend/client';
import { AppShell } from './components/AppShell/AppShell.js';

const resolver = new BackendResolver({ strategy: 'LOCAL_FIRST' });

export default function App() {
  return (
    <BackendProvider resolver={resolver}>
      <AppShell />
    </BackendProvider>
  );
}
`;
  await fs2.writeFile(join2(srcDir, "App.tsx"), appTsx, "utf-8");
  const appShellTsx = `import React from 'react';
import { SkipoThemeProvider, TopToolbar, BottomStrip } from '@skipo/ui';
import { useBackend } from '@skipo/backend/client';

export function AppShell() {
  const backend = useBackend();
  const [activeTab, setActiveTab] = React.useState('main');

  return (
    <SkipoThemeProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--skipo-bg-primary)] text-[var(--skipo-text-primary)]">
        <TopToolbar
          title="${projectName}"
          tabs={[{ id: 'main', label: 'Dashboard' }]}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
        <main className="flex-1 overflow-auto p-4">
          <h1 className="text-xl font-bold">Welcome to ${projectName}</h1>
        </main>
        <BottomStrip centerText="Skipo Backend Connected" />
      </div>
    </SkipoThemeProvider>
  );
}
`;
  await fs2.writeFile(join2(compDir, "AppShell.tsx"), appShellTsx, "utf-8");
  console.log(`React+Vite project setup complete at ${projectDir}`);
}

// src/generators/electron.ts
import { promises as fs3 } from "fs";
import { join as join3 } from "path";
async function generateElectron(projectName, _skipGit, _skipInstall) {
  const projectDir = join3(process.cwd(), projectName);
  await fs3.mkdir(projectDir, { recursive: true });
  const pkgJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    main: "main.js",
    scripts: {
      "start": "electron ."
    },
    dependencies: {
      "@skipo/core": "latest"
    },
    devDependencies: {
      "electron": "latest"
    }
  };
  await fs3.writeFile(
    join3(projectDir, "package.json"),
    JSON.stringify(pkgJson, null, 2),
    "utf-8"
  );
  const gitignoreContent = `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
.turbo/
`;
  await fs3.writeFile(
    join3(projectDir, ".gitignore"),
    gitignoreContent,
    "utf-8"
  );
  console.log("Electron project setup complete (stub).");
}

// src/index.ts
import * as readline from "readline/promises";
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      template: {
        type: "string",
        short: "t"
      },
      "no-git": {
        type: "boolean"
      },
      "no-install": {
        type: "boolean"
      }
    },
    allowPositionals: true
  });
  let projectName = positionals[0];
  let template = values.template;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  if (!projectName) {
    projectName = await rl.question("Project name? (skipo-app): ");
    if (!projectName) {
      projectName = "skipo-app";
    }
  }
  if (!template) {
    template = await rl.question("Template? (nextjs | react-vite | electron): ");
    if (!template) {
      template = "nextjs";
    }
  }
  rl.close();
  console.log(`Creating project ${projectName} with template ${template}...`);
  const skipGit = values["no-git"] ?? false;
  const skipInstall = values["no-install"] ?? false;
  try {
    switch (template) {
      case "nextjs":
        await generateNextjs(projectName, skipGit, skipInstall);
        break;
      case "react-vite":
        await generateReactVite(projectName, skipGit, skipInstall);
        break;
      case "electron":
        await generateElectron(projectName, skipGit, skipInstall);
        break;
      default:
        console.error(`Unknown template: ${template}`);
        process.exit(1);
    }
    console.log("Done!");
  } catch (error) {
    console.error("Failed to generate project:", error);
    process.exit(1);
  }
}
main();

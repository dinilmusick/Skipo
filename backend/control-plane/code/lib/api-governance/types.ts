import { NextRequest, NextResponse } from 'next/server';
import { UserRole, TrustLevel, AccountStatus, Session } from '../types';

export type { TrustLevel, AccountStatus, Session };

export type RateLimitTier =
  | 'CHEAP_READ'
  | 'NORMAL_MUTATION'
  | 'EXPENSIVE_OPERATION'
  | 'AUTHENTICATION';

export type RateLimitKeyStrategy = 'user' | 'ip' | 'user+route' | 'ip+route';

export interface RateLimitConfig {
  requests?: number;
  windowMs?: number;
  key?: RateLimitKeyStrategy;
  tier?: RateLimitTier;
}

export interface ResourceLimitsConfig {
  maxBodySize?: number; // Bytes (e.g. 256KB, 2MB, etc.)
  maxQuerySize?: number; // Bytes (default: 2048)
  maxParameterSize?: number; // Bytes (default: 1024)
  maxExecutionMs?: number; // Timeout (default: 10000)
  executionTimeoutMs?: number; // Alias for maxExecutionMs
  maxConcurrency?: number; // Max in-flight requests (default: 10/30)
  maxPageSize?: number; // Max pagination limit (default: 100)
}

export interface InputSchemaValidator {
  body?: (data: any) => { valid: boolean; error?: string };
  query?: (params: URLSearchParams) => { valid: boolean; error?: string };
  params?: (params: Record<string, string>) => { valid: boolean; error?: string };
}

export interface SecureSession {
  userId: string;
  role: UserRole;
  token?: string;
  sessionId?: string;
  accountId?: string;
  trustLevel?: TrustLevel;
  emailVerified?: boolean;
  status?: AccountStatus;
}

export interface SecureRequestContext<TBody = any> {
  session: SecureSession | null;
  requestId: string;
  ip: string;
  userAgent: string;
  body: TBody;
  query: URLSearchParams;
  params: Record<string, string>;
  isPublic: boolean;
}

export interface RouteConfig<TBody = any> {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path?: string;
  public?: boolean;
  auth?:
    | boolean
    | {
        required?: boolean;
        role?: UserRole;
        permission?: string;
      };
  minimumTrustLevel?: TrustLevel;
  emailVerificationRequired?: boolean;
  rateLimit?: RateLimitConfig;
  limits?: ResourceLimitsConfig;

  inputSchema?: InputSchemaValidator;
  authorize?: (session: SecureSession | null, req: NextRequest) => boolean | Promise<boolean>;
  handler: (
    req: NextRequest,
    ctx: SecureRequestContext<TBody>
  ) => Promise<NextResponse | Response>;
}

export type AbuseAnomalyType =
  | '401_SPIKE'
  | '403_SPIKE'
  | '429_SPIKE'
  | 'REQUEST_RATE_SPIKE'
  | 'CPU_SPIKE'
  | 'CONCURRENCY_SPIKE'
  | 'ERROR_SPIKE';

export interface RequestMetricRecord {
  timestamp: number;
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  userId?: string;
  ip: string;
  userAgent: string;
  rateLimitRemaining?: number;
  errorCode?: string;
}

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'TOKEN_REFRESH'
  | 'REFRESH_TOKEN_REUSE'
  | 'EMAIL_VERIFICATION_REQUESTED'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_VERIFICATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TRUST_CHANGED'
  | 'FEATURE_BLOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'LOGIN_FAILURE'
  | 'SUSPICIOUS_ACTIVITY';

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: SecurityEventType;
  accountId?: string;
  sessionId?: string;
  ip: string;
  metadata?: Record<string, any>;
}

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

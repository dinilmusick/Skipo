/**
 * @fileoverview API Governance Types Template
 */

export const governanceTypesTemplate = () => `import { NextRequest, NextResponse } from 'next/server';

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

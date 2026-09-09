// ══════════════════════════════════════════════════════════════════════════════════════════
// API SECURITY & RESOURCE GOVERNANCE BARREL FACADE
// ══════════════════════════════════════════════════════════════════════════════════════════
// Re-exports all core security governance symbols:
// - createSecureRoute: Framework route factory enforcing the 8-gate request pipeline
// - checkGovernanceRateLimit: Multi-tiered sliding-window rate limiter
// - isIpBlocked, recordRequestAbuseMetrics: Bot anomaly detection & zero-cost blocking
// - acquireConcurrencySlot, clampPaginationLimit, executeWithTimeout: Resource governor
// - applySecurityHeaders, CANONICAL_SECURITY_HEADERS: Security transport headers
// - handleSecureApiError: Sanitized error reporting with requestId
// - recordRequestMetric, getObservabilityMetrics: Telemetry registry

export * from './types';
export * from './rate-limiter';
export * from './abuse-detector';
export * from './resource-budget';
export * from './request-validator';
export * from './security-headers';
export * from './error-handler';
export * from './observability';
export * from './create-secure-route';

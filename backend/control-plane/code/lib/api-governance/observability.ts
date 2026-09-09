// ══════════════════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY & METRICS REGISTRY
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 12 of the API Security & Resource Governance Spec:
// Tracks every request: timestamp, request_id, route, method, status, duration,
// authenticated_user_id?, source_ip, user_agent, rate_limit_result, error_code?

import { RequestMetricRecord } from './types';

const MAX_BUFFER_SIZE = 500;

interface AggregateRouteMetrics {
  totalRequests: number;
  status2xx: number;
  status401: number;
  status403: number;
  status429: number;
  status5xx: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

const globalStoreKey = Symbol.for('__docustack_governance_observability_store__');
type GlobalWithMetrics = typeof globalThis & {
  [globalStoreKey]?: {
    records: RequestMetricRecord[];
    byRoute: Map<string, AggregateRouteMetrics>;
  };
};

const store = (globalThis as GlobalWithMetrics)[globalStoreKey] || {
  records: [] as RequestMetricRecord[],
  byRoute: new Map<string, AggregateRouteMetrics>(),
};
(globalThis as GlobalWithMetrics)[globalStoreKey] = store;

/**
 * Records an individual request's telemetry and metrics.
 */
export function recordRequestMetric(record: RequestMetricRecord): void {
  // 1. Ring buffer maintenance
  store.records.push(record);
  if (store.records.length > MAX_BUFFER_SIZE) {
    store.records.splice(0, store.records.length - MAX_BUFFER_SIZE);
  }

  // 2. Aggregate per route
  let routeStats = store.byRoute.get(record.route);
  if (!routeStats) {
    routeStats = {
      totalRequests: 0,
      status2xx: 0,
      status401: 0,
      status403: 0,
      status429: 0,
      status5xx: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
    };
    store.byRoute.set(record.route, routeStats);
  }

  routeStats.totalRequests += 1;
  routeStats.totalDurationMs += record.durationMs;
  routeStats.avgDurationMs = Math.round(routeStats.totalDurationMs / routeStats.totalRequests);

  if (record.status >= 200 && record.status < 300) routeStats.status2xx += 1;
  else if (record.status === 401) routeStats.status401 += 1;
  else if (record.status === 403) routeStats.status403 += 1;
  else if (record.status === 429) routeStats.status429 += 1;
  else if (record.status >= 500) routeStats.status5xx += 1;
}

/**
 * Returns summary metrics across all monitored routes.
 */
export function getObservabilityMetrics(): {
  totalLoggedRequests: number;
  routeMetrics: Record<string, AggregateRouteMetrics>;
} {
  const routeMetrics: Record<string, AggregateRouteMetrics> = {};
  for (const [route, stats] of store.byRoute.entries()) {
    routeMetrics[route] = { ...stats };
  }
  return {
    totalLoggedRequests: store.records.length,
    routeMetrics,
  };
}

/**
 * Returns recent raw request telemetry records.
 */
export function getRecentRequestMetrics(limit: number = 50): RequestMetricRecord[] {
  return store.records.slice(-limit);
}

/**
 * Resets recorded metrics (useful in automated tests).
 */
export function clearObservabilityMetrics(): void {
  store.records = [];
  store.byRoute.clear();
}

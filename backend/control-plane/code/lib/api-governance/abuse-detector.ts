// ══════════════════════════════════════════════════════════════════════════════════════════
// ABUSE DETECTION & BOT ANOMALY BLOCKING ENGINE
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 13 & 9 of the API Security & Resource Governance Spec:
// - ANOMALY: requests(identity, route, Δt) >> baseline
// - TRIGGERS: 401_SPIKE, 403_SPIKE, 429_SPIKE, REQUEST_RATE_SPIKE, ERROR_SPIKE
// - ACTION: instant zero-cost IP block with automated cooldown

import { AbuseAnomalyType } from './types';

interface AnomalyTracker {
  count401: number;
  count403: number;
  count429: number;
  count5xx: number;
  totalRequests: number;
  windowStart: number;
}

interface BlockRecord {
  blockedAt: number;
  unblockAt: number;
  reason: string;
  anomalyType: AbuseAnomalyType;
}

const globalStoreKey = Symbol.for('__docustack_governance_abuse_detector_store__');
type GlobalWithAbuse = typeof globalThis & {
  [globalStoreKey]?: {
    anomalies: Map<string, AnomalyTracker>;
    blocks: Map<string, BlockRecord>;
  };
};

const abuseState = (globalThis as GlobalWithAbuse)[globalStoreKey] || {
  anomalies: new Map<string, AnomalyTracker>(),
  blocks: new Map<string, BlockRecord>(),
};
(globalThis as GlobalWithAbuse)[globalStoreKey] = abuseState;

const ANOMALY_WINDOW_MS = 5 * 60 * 1000; // 5 minute rolling window
const DEFAULT_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minute temporary block

const THRESHOLDS = {
  SPIKE_401: 25, // 25 auth failures in 5 min
  SPIKE_403: 20, // 20 forbidden failures in 5 min
  SPIKE_429: 20, // 20 rate limit hits in 5 min
  SPIKE_5XX: 25, // 25 error triggers in 5 min
  SPIKE_REQUEST_RATE: 250, // 250 requests in 1 min
};

const WHITELISTED_IPS = new Set(['127.0.0.1', '::1', 'localhost']);

function isLoopback(ip: string): boolean {
  return WHITELISTED_IPS.has(ip) || ip.startsWith('127.') || ip === '::ffff:127.0.0.1';
}

/**
 * Checks whether an IP is currently blocked by abuse detection.
 */
export function isIpBlocked(ip: string): { blocked: boolean; reason?: string; retryAfterSec?: number } {
  if (isLoopback(ip)) return { blocked: false };

  const record = abuseState.blocks.get(ip);
  if (!record) return { blocked: false };

  const now = Date.now();
  if (now > record.unblockAt) {
    abuseState.blocks.delete(ip);
    return { blocked: false };
  }

  const retryAfterSec = Math.max(1, Math.ceil((record.unblockAt - now) / 1000));
  return {
    blocked: true,
    reason: record.reason,
    retryAfterSec,
  };
}

/**
 * Explicitly block an IP address.
 */
export function blockIp(
  ip: string,
  type: AbuseAnomalyType,
  reason: string,
  durationMs: number = DEFAULT_BLOCK_DURATION_MS
): void {
  if (isLoopback(ip)) return;

  const now = Date.now();
  abuseState.blocks.set(ip, {
    blockedAt: now,
    unblockAt: now + durationMs,
    reason,
    anomalyType: type,
  });

  console.warn(`[ABUSE DETECTOR] Blocked IP ${ip} for ${durationMs / 1000}s. Trigger: ${type} - ${reason}`);
}

/**
 * Unblocks an IP address.
 */
export function unblockIp(ip: string): void {
  abuseState.blocks.delete(ip);
}

/**
 * Records a request event to track anomaly triggers.
 */
export function recordRequestAbuseMetrics(
  ip: string,
  statusCode: number
): { triggeredAnomaly?: AbuseAnomalyType } {
  if (isLoopback(ip)) return {};

  const now = Date.now();
  let tracker = abuseState.anomalies.get(ip);

  if (!tracker || now - tracker.windowStart > ANOMALY_WINDOW_MS) {
    tracker = {
      count401: 0,
      count403: 0,
      count429: 0,
      count5xx: 0,
      totalRequests: 0,
      windowStart: now,
    };
    abuseState.anomalies.set(ip, tracker);
  }

  tracker.totalRequests += 1;

  if (statusCode === 401) tracker.count401 += 1;
  else if (statusCode === 403) tracker.count403 += 1;
  else if (statusCode === 429) tracker.count429 += 1;
  else if (statusCode >= 500) tracker.count5xx += 1;

  // Check triggers
  if (tracker.count401 >= THRESHOLDS.SPIKE_401) {
    blockIp(ip, '401_SPIKE', `Excessive failed authentication attempts (${tracker.count401} in 5m)`);
    return { triggeredAnomaly: '401_SPIKE' };
  }

  if (tracker.count403 >= THRESHOLDS.SPIKE_403) {
    blockIp(ip, '403_SPIKE', `Excessive forbidden requests (${tracker.count403} in 5m)`);
    return { triggeredAnomaly: '403_SPIKE' };
  }

  if (tracker.count429 >= THRESHOLDS.SPIKE_429) {
    blockIp(ip, '429_SPIKE', `Repeated rate limit exhaustion (${tracker.count429} in 5m)`);
    return { triggeredAnomaly: '429_SPIKE' };
  }

  if (tracker.count5xx >= THRESHOLDS.SPIKE_5XX) {
    blockIp(ip, 'ERROR_SPIKE', `High server fault frequency triggered (${tracker.count5xx} in 5m)`);
    return { triggeredAnomaly: 'ERROR_SPIKE' };
  }

  if (tracker.totalRequests >= THRESHOLDS.SPIKE_REQUEST_RATE) {
    blockIp(ip, 'REQUEST_RATE_SPIKE', `Abnormal request volume (${tracker.totalRequests} req in 5m)`);
    return { triggeredAnomaly: 'REQUEST_RATE_SPIKE' };
  }

  return {};
}

/**
 * Resets all abuse records (useful in tests).
 */
export function clearAbuseRecords(): void {
  abuseState.anomalies.clear();
  abuseState.blocks.clear();
}

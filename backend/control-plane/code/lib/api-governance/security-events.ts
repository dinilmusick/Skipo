// ══════════════════════════════════════════════════════════════════════════════════════════
// CENTRALIZED SECURITY EVENT LOG
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 24 of the Progressive Trust Specification:
// Records and queries security-critical lifecycle events:
// LOGIN_SUCCESS, LOGIN_FAILURE, SESSION_CREATED, SESSION_REVOKED, TOKEN_REFRESH,
// REFRESH_TOKEN_REUSE, EMAIL_VERIFICATION_REQUESTED, EMAIL_VERIFIED,
// EMAIL_VERIFICATION_FAILED, RATE_LIMIT_EXCEEDED, TRUST_CHANGED, FEATURE_BLOCKED,
// ACCOUNT_SUSPENDED.

import fs from 'fs';
import path from 'path';
import { SecurityEvent, SecurityEventType } from './types';
import { getControlPlaneDir } from '../auth-storage';

const MAX_RING_BUFFER_SIZE = 1000;
const inMemoryEvents: SecurityEvent[] = [];

function getSecurityEventsFilePath(): string {
  const dir = getControlPlaneDir();
  return path.join(dir, 'security_events.json');
}

/**
 * Appends a security event to both the in-memory ring buffer and persistent log.
 */
export function recordSecurityEvent(
  eventData: Omit<SecurityEvent, 'id' | 'timestamp'> & { timestamp?: number }
): SecurityEvent {
  const event: SecurityEvent = {
    id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: eventData.timestamp || Date.now(),
    type: eventData.type,
    accountId: eventData.accountId,
    sessionId: eventData.sessionId,
    ip: eventData.ip,
    metadata: eventData.metadata || {},
  };

  // Ring buffer
  inMemoryEvents.push(event);
  if (inMemoryEvents.length > MAX_RING_BUFFER_SIZE) {
    inMemoryEvents.shift();
  }

  // Persistent disk write (best effort)
  try {
    const filePath = getSecurityEventsFilePath();
    let events: SecurityEvent[] = [];
    if (fs.existsSync(filePath)) {
      try {
        events = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        events = [];
      }
    }
    events.push(event);
    if (events.length > MAX_RING_BUFFER_SIZE) {
      events = events.slice(-MAX_RING_BUFFER_SIZE);
    }
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf-8');
  } catch {
    // Disk write failure fallback (e.g. read-only environment)
  }

  return event;
}

/**
 * Queries security events with optional filters.
 */
export function getSecurityEvents(filter?: {
  accountId?: string;
  type?: SecurityEventType;
  limit?: number;
}): SecurityEvent[] {
  let results = [...inMemoryEvents];

  // If in-memory is empty, attempt to hydrate from disk
  if (results.length === 0) {
    try {
      const filePath = getSecurityEventsFilePath();
      if (fs.existsSync(filePath)) {
        results = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        inMemoryEvents.push(...results.slice(-MAX_RING_BUFFER_SIZE));
      }
    } catch {}
  }

  if (filter?.accountId) {
    results = results.filter((e) => e.accountId === filter.accountId);
  }
  if (filter?.type) {
    results = results.filter((e) => e.type === filter.type);
  }

  const limit = filter?.limit || 100;
  return results.slice(-limit).reverse();
}

/**
 * Resets the in-memory event buffer (useful for test isolation).
 */
export function clearSecurityEventsForTest(): void {
  inMemoryEvents.length = 0;
}

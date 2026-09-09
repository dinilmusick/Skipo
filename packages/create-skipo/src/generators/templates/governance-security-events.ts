/**
 * @fileoverview Security Events In-Memory Log Ring Template
 */

export const governanceSecurityEventsTemplate = () => `export interface SecurityEvent {
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
